use super::*;
use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Env, Map,
};

#[test]
fn test_penalty_for_table() {
    struct Case {
        amount: i128,
        bps: u32,
        expected_penalty: i128,
        expected_refund: i128,
    }

    let cases = [
        // 1. Single unit at 200 bps (rounds up to 1)
        Case { amount: 1, bps: 200, expected_penalty: 1, expected_refund: 0 },
        // 2. 200 bps boundary (10_000 / 200 = 50) - 1: 49 base units
        Case { amount: 49, bps: 200, expected_penalty: 1, expected_refund: 48 },
        // 3. 200 bps boundary exact: 50 base units
        Case { amount: 50, bps: 200, expected_penalty: 1, expected_refund: 49 },
        // 4. 200 bps boundary + 1: 51 base units
        Case { amount: 51, bps: 200, expected_penalty: 2, expected_refund: 49 },
        // 5. Single unit at 500 bps (boundary 10_000 / 500 = 20)
        Case { amount: 1, bps: 500, expected_penalty: 1, expected_refund: 0 },
        // 6. 500 bps boundary - 1: 19 base units
        Case { amount: 19, bps: 500, expected_penalty: 1, expected_refund: 18 },
        // 7. 500 bps boundary exact: 20 base units
        Case { amount: 20, bps: 500, expected_penalty: 1, expected_refund: 19 },
        // 8. 500 bps boundary + 1: 21 base units
        Case { amount: 21, bps: 500, expected_penalty: 2, expected_refund: 19 },
        // 9. Exact round amount at 500 bps: 1,000 -> 50 penalty, 950 refund
        Case { amount: 1_000, bps: 500, expected_penalty: 50, expected_refund: 950 },
        // 10. Rounding up at 500 bps: 1,001 -> 51 penalty (ceil), 950 refund
        Case { amount: 1_001, bps: 500, expected_penalty: 51, expected_refund: 950 },
        // 11. 300 bps boundary (10_000 / 300 = 33.33) -> 33
        Case { amount: 33, bps: 300, expected_penalty: 1, expected_refund: 32 },
        // 12. 300 bps boundary + 1 -> 34
        Case { amount: 34, bps: 300, expected_penalty: 2, expected_refund: 32 },
        // 13. 0 bps: always 0 penalty, full refund
        Case { amount: 1, bps: 0, expected_penalty: 0, expected_refund: 1 },
        Case { amount: 10_000, bps: 0, expected_penalty: 0, expected_refund: 10_000 },
        // 14. 10_000 bps (100%): always full penalty, 0 refund
        Case { amount: 1, bps: 10_000, expected_penalty: 1, expected_refund: 0 },
        Case { amount: 10_000, bps: 10_000, expected_penalty: 10_000, expected_refund: 0 },
        // 15. MAX_AMOUNT at 500 bps
        Case {
            amount: MAX_AMOUNT,
            bps: 500,
            expected_penalty: 50_000_000_000,
            expected_refund: 950_000_000_000,
        },
        // 16. MAX_AMOUNT at 0 bps
        Case {
            amount: MAX_AMOUNT,
            bps: 0,
            expected_penalty: 0,
            expected_refund: MAX_AMOUNT,
        },
        // 17. MAX_AMOUNT at 10_000 bps
        Case {
            amount: MAX_AMOUNT,
            bps: 10_000,
            expected_penalty: MAX_AMOUNT,
            expected_refund: 0,
        },
    ];

    for c in cases {
        let (penalty, refund) = EscrowContract::penalty_for(c.amount, c.bps).expect("valid case");
        let amount = c.amount;
        let bps = c.bps;
        assert_eq!(
            penalty, c.expected_penalty,
            "penalty mismatch for amount={amount}, bps={bps}"
        );
        assert_eq!(
            refund, c.expected_refund,
            "refund mismatch for amount={amount}, bps={bps}"
        );
        assert_eq!(
            penalty + refund,
            c.amount,
            "penalty + refund must equal amount"
        );
    }

    // Invalid cases
    assert_eq!(
        EscrowContract::penalty_for(0, 500),
        Err(Error::InvalidAmount)
    );
    assert_eq!(
        EscrowContract::penalty_for(-100, 500),
        Err(Error::InvalidAmount)
    );
    assert_eq!(
        EscrowContract::penalty_for(1_000, 10_001),
        Err(Error::PenaltyTooHigh)
    );
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 100, ..ProptestConfig::default() })]

    #[test]
    fn proptest_penalty_math_properties(
        amount in 1i128..=MAX_AMOUNT,
        bps in 0u32..=MAX_PENALTY_BPS,
    ) {
        let (penalty, refund) = EscrowContract::penalty_for(amount, bps).unwrap();

        // 1. Conservation of funds
        prop_assert_eq!(penalty + refund, amount);

        // 2. Bounded penalty
        prop_assert!(penalty >= 0);
        prop_assert!(penalty <= amount);

        // 3. Protocol-favouring rounding: penalty >= floor(amount * bps / 10_000)
        let floor_penalty = (amount * i128::from(bps)) / 10_000;
        prop_assert!(penalty >= floor_penalty);

        // 4. Exact boundaries for 0 and 10_000 bps
        if bps == 0 {
            prop_assert_eq!(penalty, 0);
            prop_assert_eq!(refund, amount);
        }
        if bps == 10_000 {
            prop_assert_eq!(penalty, amount);
            prop_assert_eq!(refund, 0);
        }
    }
}

struct TestFixture<'a> {
    env: &'a Env,
    client: EscrowContractClient<'a>,
    sac: StellarAssetClient<'a>,
    token: Address,
    admin: Address,
    owner: Address,
    fee_recipient: Address,
}

impl<'a> TestFixture<'a> {
    fn new(env: &'a Env) -> Self {
        env.mock_all_auths();
        env.ledger().with_mut(|l| l.timestamp = 1000);

        let admin = Address::generate(env);
        let owner = Address::generate(env);
        let fee_recipient = Address::generate(env);

        let token = env
            .register_stellar_asset_contract_v2(admin.clone())
            .address();
        let sac = StellarAssetClient::new(env, &token);

        let contract_id = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(env, &contract_id);
        client.initialize(&admin, &token, &fee_recipient, &200, &300, &500);

        sac.mint(&owner, &1_000_000_000);
        sac.mint(&admin, &1_000_000_000);

        Self {
            env,
            client,
            sac,
            token,
            admin,
            owner,
            fee_recipient,
        }
    }

    fn create_and_fund(&self, amount: i128, penalty_bps: u32) -> u64 {
        let pool = 10_000_000;
        self.client.deposit_yield_pool(&self.admin, &pool);

        let id = self.client.create_commitment(
            &self.owner,
            &self.token,
            &amount,
            &RiskProfile::Safe,
            &30,
            &penalty_bps,
            &Map::new(self.env),
        );
        self.client.fund_escrow(&id);
        id
    }
}

#[test]
fn test_refund_partial_minimums_and_balances() {
    let env = Env::default();
    let f = TestFixture::new(&env);

    let initial_owner_balance = f.sac.balance(&f.owner);
    let initial_fee_balance = f.sac.balance(&f.fee_recipient);

    let principal = 50_000_000; // 5 XLM
    let id = f.create_and_fund(principal, 500); // 500 bps = 5% penalty

    let owner_after_fund = f.sac.balance(&f.owner);
    assert_eq!(owner_after_fund, initial_owner_balance - principal);

    // 1. Partial withdrawal below MIN_PARTIAL_WITHDRAWAL (10_000_000) rejected
    let sub_min = MIN_PARTIAL_WITHDRAWAL - 1;
    let res = f.client.try_refund_partial(&id, &sub_min);
    assert_eq!(res, Err(Ok(Error::BelowMinimum)));
    assert_eq!(f.sac.balance(&f.owner), owner_after_fund);
    assert_eq!(f.sac.balance(&f.fee_recipient), initial_fee_balance);

    // 2. Partial withdrawal leaving dust remainder (0 < remaining < MIN_REMAINING_PRINCIPAL) rejected
    let leaves_dust = principal - 1; // leaves 1 stroop
    let res_dust = f.client.try_refund_partial(&id, &leaves_dust);
    assert_eq!(res_dust, Err(Ok(Error::BelowMinimum)));
    assert_eq!(f.sac.balance(&f.owner), owner_after_fund);
    assert_eq!(f.sac.balance(&f.fee_recipient), initial_fee_balance);

    // 3. Valid partial withdrawal: withdraw 20_000_000, leaving 30_000_000
    let withdraw_1 = 20_000_000;
    // 20_000_000 * 500 / 10_000 = 1_000_000 penalty, 19_000_000 refund
    let refund_1 = f.client.refund_partial(&id, &withdraw_1);
    assert_eq!(refund_1, 19_000_000);
    assert_eq!(
        f.sac.balance(&f.fee_recipient),
        initial_fee_balance + 1_000_000
    );
    assert_eq!(f.sac.balance(&f.owner), owner_after_fund + 19_000_000);

    let c = f.client.get_commitment(&id);
    assert_eq!(c.amount, 30_000_000);
    assert_eq!(c.status, EscrowStatus::Funded);

    // 4. Full withdrawal of the remaining balance: withdraw remaining 30_000_000
    // 30_000_000 * 500 / 10_000 = 1_500_000 penalty, 28_500_000 refund
    let refund_2 = f.client.refund_partial(&id, &30_000_000);
    assert_eq!(refund_2, 28_500_000);
    assert_eq!(
        f.sac.balance(&f.fee_recipient),
        initial_fee_balance + 1_000_000 + 1_500_000
    );
    assert_eq!(
        f.sac.balance(&f.owner),
        owner_after_fund + 19_000_000 + 28_500_000
    );

    let c_final = f.client.get_commitment(&id);
    assert_eq!(c_final.amount, 0);
    assert_eq!(c_final.status, EscrowStatus::Refunded);
}

#[test]
fn test_legacy_commitment_below_minimum_can_fully_withdraw() {
    let env = Env::default();
    let f = TestFixture::new(&env);

    // Legacy commitment created with amount below MIN_PARTIAL_WITHDRAWAL (e.g. 5_000_000)
    let small_principal = 5_000_000;
    let id = f.create_and_fund(small_principal, 500);

    // Partial withdrawal leaving a remainder is rejected
    let res = f.client.try_refund_partial(&id, &2_000_000);
    assert_eq!(res, Err(Ok(Error::BelowMinimum)));

    // Full withdrawal (remaining == 0) is permitted even though amount < MIN_PARTIAL_WITHDRAWAL
    let (penalty, expected_refund) = EscrowContract::penalty_for(small_principal, 500).unwrap();
    assert_eq!(penalty + expected_refund, small_principal);
    let refund = f.client.refund_partial(&id, &small_principal);
    assert_eq!(refund, expected_refund);
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Refunded);
    assert_eq!(f.client.get_commitment(&id).amount, 0);
}

#[test]
fn test_slicing_withdrawal_never_pays_less_penalty_than_full_withdrawal() {
    // For various amounts and basis points, verify that slicing a withdrawal
    // into smaller chunks always results in total penalty >= full single withdrawal penalty.
    let test_bps = [100, 200, 300, 500, 1000, 2500, 5000];
    let amounts = [
        30_000_000,
        55_555_555,
        100_000_000,
        123_456_789,
        500_000_000,
    ];

    for bps in test_bps {
        for total in amounts {
            let (full_penalty, _) = EscrowContract::penalty_for(total, bps).unwrap();

            // Slice into chunks of MIN_PARTIAL_WITHDRAWAL (10_000_000)
            let chunk_size = MIN_PARTIAL_WITHDRAWAL;
            let mut remaining = total;
            let mut sum_sliced_penalty = 0i128;

            while remaining > 0 {
                let this_chunk = chunk_size.min(remaining);
                let (chunk_pen, _) = EscrowContract::penalty_for(this_chunk, bps).unwrap();
                sum_sliced_penalty += chunk_pen;
                remaining -= this_chunk;
            }

            assert!(
                sum_sliced_penalty >= full_penalty,
                "sliced penalty ({sum_sliced_penalty}) must be >= full penalty ({full_penalty}) for total={total}, bps={bps}"
            );
        }
    }
}
