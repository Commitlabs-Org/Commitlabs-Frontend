//! Yield-pool reservation accounting tests.
//!
//! Covers reservation on funding, consumption on matured release, release on
//! any yield-forfeiting exit, pool contention at funding time, surplus
//! withdrawal, and a randomized invariant property test. The reservation
//! invariant asserted throughout is `0 <= reserved <= balance`.

use crate::{DataKey, Error, EscrowContract, EscrowContractClient, RiskProfile};
use proptest::prelude::*;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient};
use soroban_sdk::{Address, Env, Map, String};

/// Tokens deposited into the yield pool by the admin in most tests.
const POOL_DEPOSIT: i128 = 1_000;
/// Principal of the reference commitment lifecycle.
const PRINCIPAL: i128 = 1_000;
/// Duration of the reference commitment lifecycle.
const DURATION_DAYS: u32 = 30;
/// `calculate_accrued_yield(1_000, 30, Aggressive)` = 1000 bps annualized.
const ACCRUED_YIELD: i128 = 8;

struct Ctx<'a> {
    env: &'a Env,
    client: EscrowContractClient<'a>,
    contract_id: Address,
    token: Address,
    admin: Address,
    owner: Address,
}

fn setup(env: &Env) -> Ctx<'_> {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let owner = Address::generate(env);
    let fee_recipient = Address::generate(env);

    let token = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token_admin = StellarAssetClient::new(env, &token);
    token_admin.mint(&owner, &1_000_000_000);
    token_admin.mint(&admin, &1_000_000_000);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(env, &contract_id);
    client.initialize(&admin, &token, &fee_recipient, &200u32, &300u32, &500u32);

    Ctx {
        env,
        client,
        contract_id,
        token,
        admin,
        owner,
    }
}

fn create_commitment(
    ctx: &Ctx,
    amount: i128,
    risk: RiskProfile,
    duration_days: u32,
    penalty_bps: u32,
) -> u64 {
    ctx.client.create_commitment(
        &ctx.owner,
        &ctx.token,
        &amount,
        &risk,
        &duration_days,
        &penalty_bps,
        &Map::new(ctx.env),
    )
}

fn set_time(ctx: &Ctx, timestamp: u64) {
    ctx.env.ledger().with_mut(|ledger| {
        ledger.timestamp = timestamp;
    });
}

fn maturity_of(ctx: &Ctx, commitment_id: u64) -> u64 {
    ctx.client.get_commitment(&commitment_id).maturity
}

fn set_matured(ctx: &Ctx, commitment_id: u64) {
    set_time(ctx, maturity_of(ctx, commitment_id) + 1);
}

fn assert_status(ctx: &Ctx, balance: i128, reserved: i128) {
    let status = ctx.client.get_yield_pool_status();
    assert_eq!(status.balance, balance);
    assert_eq!(status.reserved, reserved);
    assert_eq!(status.available, balance - reserved);
    assert_eq!(ctx.client.get_yield_pool_balance(), balance);
    assert_invariant(ctx);
}

fn assert_invariant(ctx: &Ctx) {
    let status = ctx.client.get_yield_pool_status();
    assert!(status.reserved >= 0, "reserved went negative");
    assert!(
        status.balance >= status.reserved,
        "reserved exceeded balance"
    );
    assert_eq!(status.available, status.balance - status.reserved);
}

/// Every terminal path, with the pool state it must leave behind.
#[derive(Clone, Copy, Debug)]
#[allow(clippy::enum_variant_names)]
enum Exit {
    /// `release` after maturity.
    Release,
    /// `settle_commitment` after maturity.
    Settle,
    /// `refund` before maturity.
    Refund,
    /// `early_exit_commitment` before maturity.
    EarlyExit,
    /// `refund_partial` withdrawing the full principal.
    RefundPartialFull,
    /// `dispute` then `resolve_dispute(release_to_owner = true)` after maturity.
    DisputeReleaseMatured,
    /// `dispute` then `resolve_dispute(release_to_owner = true)` before maturity.
    DisputeReleaseBeforeMaturity,
    /// `dispute` then `resolve_dispute(release_to_owner = false)`.
    DisputeRefund,
    /// Violated via `record_attestation`, then released after maturity.
    ViolatedReleaseMatured,
    /// Violated via `record_attestation`, then refunded.
    ViolatedRefund,
}

const EXITS: [Exit; 10] = [
    Exit::Release,
    Exit::Settle,
    Exit::Refund,
    Exit::EarlyExit,
    Exit::RefundPartialFull,
    Exit::DisputeReleaseMatured,
    Exit::DisputeReleaseBeforeMaturity,
    Exit::DisputeRefund,
    Exit::ViolatedReleaseMatured,
    Exit::ViolatedRefund,
];

impl Exit {
    /// `(balance, reserved)` expected once the exit completes.
    fn expected_pool_state(self) -> (i128, i128) {
        match self {
            Exit::Release
            | Exit::Settle
            | Exit::DisputeReleaseMatured
            | Exit::ViolatedReleaseMatured => (POOL_DEPOSIT - ACCRUED_YIELD, 0),
            Exit::Refund
            | Exit::EarlyExit
            | Exit::RefundPartialFull
            | Exit::DisputeReleaseBeforeMaturity
            | Exit::DisputeRefund
            | Exit::ViolatedRefund => (POOL_DEPOSIT, 0),
        }
    }
}

fn mark_violated(ctx: &Ctx, commitment_id: u64) {
    ctx.client.set_violation_threshold(&50u32);
    let attestor = Address::generate(ctx.env);
    ctx.client.add_attestor(&attestor);
    ctx.client
        .record_attestation(&commitment_id, &attestor, &10u32);
}

#[test]
fn lifecycle_table_reserves_then_releases_or_forfeits_yield() {
    for exit in EXITS {
        let env = Env::default();
        let ctx = setup(&env);
        ctx.client.deposit_yield_pool(&POOL_DEPOSIT);
        assert_status(&ctx, POOL_DEPOSIT, 0);

        let id = create_commitment(&ctx, PRINCIPAL, RiskProfile::Aggressive, DURATION_DAYS, 500);
        ctx.client.fund_escrow(&id);

        // Funding reserves the promise: the pool total is unchanged, but the
        // reserved portion is now committed to this commitment.
        assert_status(&ctx, POOL_DEPOSIT, ACCRUED_YIELD);

        match exit {
            Exit::Release => {
                set_matured(&ctx, id);
                ctx.client.release(&id, &ctx.owner);
            }
            Exit::Settle => {
                set_matured(&ctx, id);
                ctx.client.settle_commitment(&id, &ctx.owner);
            }
            Exit::Refund => {
                ctx.client.refund(&id);
            }
            Exit::EarlyExit => {
                ctx.client.early_exit_commitment(&id, &ctx.owner);
            }
            Exit::RefundPartialFull => {
                ctx.client.refund_partial(&id, &PRINCIPAL);
            }
            Exit::DisputeReleaseMatured => {
                ctx.client
                    .dispute(&id, &ctx.owner, &String::from_str(&env, "late"));
                // Freezing the commitment keeps its reservation in place.
                assert_status(&ctx, POOL_DEPOSIT, ACCRUED_YIELD);
                set_matured(&ctx, id);
                ctx.client.resolve_dispute(&id, &true);
            }
            Exit::DisputeReleaseBeforeMaturity => {
                ctx.client
                    .dispute(&id, &ctx.owner, &String::from_str(&env, "late"));
                ctx.client.resolve_dispute(&id, &true);
            }
            Exit::DisputeRefund => {
                ctx.client
                    .dispute(&id, &ctx.owner, &String::from_str(&env, "late"));
                ctx.client.resolve_dispute(&id, &false);
            }
            Exit::ViolatedReleaseMatured => {
                mark_violated(&ctx, id);
                assert_status(&ctx, POOL_DEPOSIT, ACCRUED_YIELD);
                set_matured(&ctx, id);
                ctx.client.resolve_dispute(&id, &true);
            }
            Exit::ViolatedRefund => {
                mark_violated(&ctx, id);
                ctx.client.resolve_dispute(&id, &false);
            }
        }

        let (expected_balance, expected_reserved) = exit.expected_pool_state();
        assert_status(&ctx, expected_balance, expected_reserved);
    }
}

#[test]
fn release_decreases_balance_and_reserved_by_accrued_yield() {
    let env = Env::default();
    let ctx = setup(&env);
    ctx.client.deposit_yield_pool(&POOL_DEPOSIT);

    let id = create_commitment(&ctx, PRINCIPAL, RiskProfile::Safe, DURATION_DAYS, 500);
    ctx.client.fund_escrow(&id);

    let accrued_yield = ctx.client.get_commitment(&id).accrued_yield;
    assert_status(&ctx, POOL_DEPOSIT, accrued_yield);

    set_matured(&ctx, id);
    let payout = ctx.client.release(&id, &ctx.owner);

    assert_eq!(payout, PRINCIPAL + accrued_yield);
    assert_status(&ctx, POOL_DEPOSIT - accrued_yield, 0);
}

#[test]
fn refund_releases_reservation_without_touching_balance() {
    let env = Env::default();
    let ctx = setup(&env);
    ctx.client.deposit_yield_pool(&POOL_DEPOSIT);

    let id = create_commitment(&ctx, PRINCIPAL, RiskProfile::Safe, DURATION_DAYS, 500);
    ctx.client.fund_escrow(&id);
    let accrued_yield = ctx.client.get_commitment(&id).accrued_yield;
    assert_status(&ctx, POOL_DEPOSIT, accrued_yield);

    ctx.client.refund(&id);

    assert_status(&ctx, POOL_DEPOSIT, 0);
    assert_eq!(
        ctx.client.get_commitment(&id).status,
        crate::EscrowStatus::Refunded
    );
}

#[test]
fn partial_refund_keeps_reservation_until_full_exit() {
    let env = Env::default();
    let ctx = setup(&env);
    let pool_deposit = 1_000_000;
    ctx.client.deposit_yield_pool(&pool_deposit);

    let id = create_commitment(&ctx, 20_000_000, RiskProfile::Safe, DURATION_DAYS, 500);
    ctx.client.fund_escrow(&id);
    let accrued_yield = ctx.client.get_commitment(&id).accrued_yield;

    // Partial exits meet minimums and keep the full reservation: over-reserved, never under.
    ctx.client.refund_partial(&id, &10_000_000);
    assert_status(&ctx, pool_deposit, accrued_yield);

    ctx.client.refund_partial(&id, &10_000_000);
    assert_status(&ctx, pool_deposit, 0);
}

#[test]
fn second_commitment_is_rejected_at_funding_when_pool_is_committed() {
    let env = Env::default();
    let ctx = setup(&env);
    ctx.client.deposit_yield_pool(&100);

    // Aggressive for the full 365 days yields exactly 10% of principal.
    let first = create_commitment(&ctx, 600, RiskProfile::Aggressive, 365, 500);
    let second = create_commitment(&ctx, 600, RiskProfile::Aggressive, 365, 500);
    assert_eq!(ctx.client.get_commitment(&first).accrued_yield, 60);
    assert_eq!(ctx.client.get_commitment(&second).accrued_yield, 60);

    let token = TokenClient::new(ctx.env, &ctx.token);
    let owner_balance_before = token.balance(&ctx.owner);

    ctx.client.fund_escrow(&first);
    assert_status(&ctx, 100, 60);

    // The second promise cannot be made: it is rejected while funding, not
    // later at release.
    assert_eq!(
        ctx.client.try_fund_escrow(&second),
        Err(Ok(Error::InsufficientYieldPool))
    );

    // No tokens moved for the rejected funding, and the commitment is untouched.
    assert_eq!(token.balance(&ctx.owner), owner_balance_before - 600);
    // The contract holds the first commitment's principal plus the pooled yield.
    assert_eq!(token.balance(&ctx.client.address), 600 + 100);
    assert_eq!(
        ctx.client.get_commitment(&second).status,
        crate::EscrowStatus::Created
    );
    assert_status(&ctx, 100, 60);

    // The first commitment's promise survives: it can still be released.
    set_matured(&ctx, first);
    let payout = ctx.client.release(&first, &ctx.owner);
    assert_eq!(payout, 660);
    assert_status(&ctx, 40, 0);
}

#[test]
fn zero_yield_commitment_funds_and_releases() {
    let env = Env::default();
    let ctx = setup(&env);

    // 1 unit for 1 day rounds accrued yield down to zero, so nothing is
    // reserved and funding needs no pool at all.
    let id = create_commitment(&ctx, 1, RiskProfile::Safe, 1, 500);
    assert_eq!(ctx.client.get_commitment(&id).accrued_yield, 0);

    ctx.client.fund_escrow(&id);
    assert_status(&ctx, 0, 0);

    set_matured(&ctx, id);
    assert_eq!(ctx.client.release(&id, &ctx.owner), 1);
    assert_status(&ctx, 0, 0);
}

#[test]
fn withdraw_yield_pool_succeeds_up_to_available_only() {
    let env = Env::default();
    let ctx = setup(&env);
    ctx.client.deposit_yield_pool(&POOL_DEPOSIT);

    let id = create_commitment(&ctx, PRINCIPAL, RiskProfile::Safe, DURATION_DAYS, 500);
    ctx.client.fund_escrow(&id);
    let accrued_yield = ctx.client.get_commitment(&id).accrued_yield;
    let available = POOL_DEPOSIT - accrued_yield;

    let recipient = Address::generate(&env);
    let token = TokenClient::new(ctx.env, &ctx.token);

    assert_eq!(
        ctx.client
            .try_withdraw_yield_pool(&recipient, &(available + 1)),
        Err(Ok(Error::InsufficientYieldPool))
    );
    assert_status(&ctx, POOL_DEPOSIT, accrued_yield);

    ctx.client.withdraw_yield_pool(&recipient, &available);
    assert_eq!(token.balance(&recipient), available);
    assert_status(&ctx, accrued_yield, accrued_yield);

    assert_eq!(
        ctx.client.try_withdraw_yield_pool(&recipient, &1),
        Err(Ok(Error::InsufficientYieldPool))
    );
    assert_status(&ctx, accrued_yield, accrued_yield);
}

#[test]
fn withdraw_yield_pool_requires_authorization() {
    let env = Env::default();
    let ctx = setup(&env);
    ctx.client.deposit_yield_pool(&POOL_DEPOSIT);

    let recipient = Address::generate(&env);
    env.set_auths(&[]);

    assert!(ctx.client.try_withdraw_yield_pool(&recipient, &10).is_err());
    assert_status(&ctx, POOL_DEPOSIT, 0);
}

#[test]
fn commitment_funded_before_reservation_accounting_can_still_release() {
    let env = Env::default();
    let ctx = setup(&env);
    ctx.client.deposit_yield_pool(&POOL_DEPOSIT);

    let id = create_commitment(&ctx, PRINCIPAL, RiskProfile::Safe, DURATION_DAYS, 500);
    ctx.client.fund_escrow(&id);

    // Simulate a commitment funded before this upgrade: no reservation flag and
    // no reserved total, so the release must fall back to paying from the pool.
    let id_key = DataKey::Reserved(id);
    env.as_contract(&ctx.contract_id, || {
        let storage = env.storage().instance();
        storage.set(&DataKey::ReservedYield, &0i128);
        storage.remove(&id_key);
    });
    assert_status(&ctx, POOL_DEPOSIT, 0);

    set_matured(&ctx, id);
    let accrued_yield = ctx.client.get_commitment(&id).accrued_yield;
    assert_eq!(
        ctx.client.release(&id, &ctx.owner),
        PRINCIPAL + accrued_yield
    );
    assert_status(&ctx, POOL_DEPOSIT - accrued_yield, 0);
}

#[derive(Clone, Copy, Debug)]
enum Op {
    Deposit(i128),
    Fund(u32),
    Release(u32),
    Refund(u32),
    Withdraw(i128),
}

fn op_strategy() -> impl Strategy<Value = Op> {
    prop_oneof![
        3 => (1i128..=2_000i128).prop_map(Op::Deposit),
        4 => (0u32..4).prop_map(Op::Fund),
        3 => (0u32..4).prop_map(Op::Release),
        3 => (0u32..4).prop_map(Op::Refund),
        3 => (1i128..=2_000i128).prop_map(Op::Withdraw),
    ]
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 24, ..ProptestConfig::default() })]

    #[test]
    fn invariant_holds_after_every_random_operation(
        ops in prop::collection::vec(op_strategy(), 0..24),
    ) {
        let env = Env::default();
        let ctx = setup(&env);

        let ids = [
            create_commitment(&ctx, 100, RiskProfile::Balanced, 30, 500),
            create_commitment(&ctx, 500, RiskProfile::Aggressive, 90, 500),
            create_commitment(&ctx, 1_000, RiskProfile::Safe, 365, 500),
            create_commitment(&ctx, 1, RiskProfile::Safe, 1, 500),
        ];

        for op in ops {
            match op {
                Op::Deposit(amount) => {
                    let _ = ctx.client.try_deposit_yield_pool(&amount);
                }
                Op::Fund(slot) => {
                    let _ = ctx.client.try_fund_escrow(&ids[slot as usize]);
                }
                Op::Release(slot) => {
                    let id = ids[slot as usize];
                    if let Ok(Ok(commitment)) = ctx.client.try_get_commitment(&id) {
                        set_time(&ctx, commitment.maturity + 1);
                        let _ = ctx.client.try_release(&id, &ctx.owner);
                    }
                }
                Op::Refund(slot) => {
                    let _ = ctx.client.try_refund(&ids[slot as usize]);
                }
                Op::Withdraw(amount) => {
                    let recipient = Address::generate(ctx.env);
                    let _ = ctx.client.try_withdraw_yield_pool(&recipient, &amount);
                }
            }
            assert_invariant(&ctx);
        }
    }
}
