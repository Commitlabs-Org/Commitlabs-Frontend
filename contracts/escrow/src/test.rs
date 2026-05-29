#[test]
fn admin_can_rotate_admin_and_fee_recipient() {
    let f = setup();
    let new_admin = Address::generate(&f.env);
    let new_fee = Address::generate(&f.env);

    // Only admin can rotate admin
    f.env.set_auths(&[&f.admin]);
    f.client.set_admin(&new_admin);
    // Only new admin can rotate fee recipient
    f.env.set_auths(&[&new_admin]);
    f.client.set_fee_recipient(&new_fee);

    // Check storage
    let stored_admin: Address = f.env.storage().instance().get(&DataKey::Admin).unwrap();
    let stored_fee: Address = f.env.storage().instance().get(&DataKey::FeeRecipient).unwrap();
    assert_eq!(stored_admin, new_admin);
    assert_eq!(stored_fee, new_fee);
}

#[test]
fn unauthorized_cannot_rotate_admin_or_fee_recipient() {
    let f = setup();
    let new_admin = Address::generate(&f.env);
    let new_fee = Address::generate(&f.env);
    let not_admin = Address::generate(&f.env);

    // Not admin tries to rotate admin
    f.env.set_auths(&[&not_admin]);
    let res = f.client.try_set_admin(&new_admin);
    assert_eq!(res, Err(Ok(Error::Unauthorized)));

    // Not admin tries to rotate fee recipient
    let res2 = f.client.try_set_fee_recipient(&new_fee);
    assert_eq!(res2, Err(Ok(Error::Unauthorized)));
}
#![cfg(test)]

use super::*;
use proptest::prelude::*;
use proptest::test_runner::TestRunner;
use soroban_sdk::{
    map,
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Bytes, BytesN, Env, String,
};

// ── Test fixture ─────────────────────────────────────────────────────────────

/// Spins up a test environment with a Stellar Asset Contract token and a
/// deployed, initialized escrow contract. Returns the pieces tests need.
struct Fixture<'a> {
    env: Env,
    client: EscrowContractClient<'a>,
    token: TokenClient<'a>,
    token_admin: StellarAssetClient<'a>,
    admin: Address,
    fee_recipient: Address,
    asset: Address,
    contract_id: Address,
}

fn setup<'a>() -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);

    // Deploy a SAC token to use as the escrow asset.
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let asset = sac.address();
    let token = TokenClient::new(&env, &asset);
    let token_admin = StellarAssetClient::new(&env, &asset);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    
    // Initialize with default penalties: Safe 2%, Balanced 3%, Aggressive 5%
    const SAFE_DEFAULT_PENALTY_BPS: u32 = 200;      // 2%
    const BALANCED_DEFAULT_PENALTY_BPS: u32 = 300;  // 3%
    const AGGRESSIVE_DEFAULT_PENALTY_BPS: u32 = 500; // 5%
    
    client.initialize(
        &admin,
        &asset,
        &fee_recipient,
        &SAFE_DEFAULT_PENALTY_BPS,
        &BALANCED_DEFAULT_PENALTY_BPS,
        &AGGRESSIVE_DEFAULT_PENALTY_BPS,
    );

    Fixture {
        env,
        client,
        token,
        token_admin,
        admin,
        fee_recipient,
        asset,
        contract_id,
    }
}

fn fund_owner(f: &Fixture, owner: &Address, amount: i128) {
    f.token_admin.mint(owner, &amount);
}

// ── Event assertion helper ────────────────────────────────────────────────────

/// Asserts that the escrow contract emitted exactly one event whose first topic
/// matches `event_name` and whose data converts to `expected_data`.
///
/// Soroban's `env.events().all()` returns a `Vec<(Address, Vec<Val>, Val)>`
/// where each entry is `(contract_id, topics, data)`.  We filter to events
/// emitted by the escrow contract and whose first topic is the expected symbol,
/// then compare the data payload.
///
/// # Panics
/// Panics with a descriptive message if no matching event is found or if the
/// data does not match.
fn assert_event<D: IntoVal<Env, Val>>(
    env: &Env,
    contract_id: &Address,
    event_name: &str,
    expected_data: D,
) {
    let all = env.events().all();
    let sym = Symbol::new(env, event_name);
    let expected_val: Val = expected_data.into_val(env);

    let found = all.iter().any(|(id, topics, data)| {
        if &id != contract_id {
            return false;
        }
        // topics is soroban_sdk::Vec<Val>; first element is the Symbol
        if topics.len() == 0 {
            return false;
        }
        let first_val = topics.get(0).unwrap();
        let first_topic = Symbol::try_from_val(env, &first_val)
            .unwrap_or_else(|_| Symbol::new(env, "__none__"));
        if first_topic != sym {
            return false;
        }
        data == expected_val
    });

    assert!(
        found,
        "expected event '{}' with matching data not found in emitted events",
        event_name
    );
}

// ── Existing lifecycle tests (unchanged) ─────────────────────────────────────

#[test]
fn initialize_is_one_time() {
    let f = setup();
    let other = Address::generate(&f.env);
    let res = f
        .client
        .try_initialize(&f.admin, &f.asset, &other);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn upgrade_succeeds_for_admin() {
    let f = setup();
    let wasm_bytes = Bytes::from_array(&f.env, &[0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    // Use the hash of the empty-wasm placeholder already present in the
    // test ledger (sha256 of empty string). This ensures the hash exists in
    // ledger so `update_current_contract_wasm` can succeed in the host.
    let new_hash = BytesN::from_array(
        &f.env,
        &[
            0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14, 0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f,
            0xb9, 0x24, 0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c, 0xa4, 0x95, 0x99, 0x1b,
            0x78, 0x52, 0xb8, 0x55,
        ],
    );
    let res = f.client.try_upgrade(&new_hash);
    assert_eq!(res, Ok(Ok(())));
}

#[test]
fn upgrade_rejects_zero_hash() {
    let f = setup();
    let zero_hash = BytesN::from_array(&f.env, &[0u8; 32]);
    let res = f.client.try_upgrade(&zero_hash);
    assert_eq!(res, Err(Ok(Error::InvalidWasmHash)));
}

#[test]
fn upgrade_rejects_when_admin_missing() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let hash = BytesN::from_array(&env, &[2u8; 32]);
    let res = client.try_upgrade(&hash);
    assert_eq!(res, Err(Ok(Error::NotInitialized)));
}

#[test]
fn upgrade_rejects_without_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    env.as_contract(&contract_id, || {
        env.storage().instance().set(&DataKey::Admin, &admin);
    });
    // Avoid uploading a wasm blob in this test host; use a precomputed hash.
    let hash = BytesN::from_array(&env, &[3u8; 32]);
    let res = client.try_upgrade(&hash);
    assert!(res.is_err(), "expected unauthorized upgrade to be rejected");
}

#[test]
fn create_and_fund_locks_funds() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300, &Map::new(&f.env));
    let c = f.client.get_commitment(&id);
    assert_eq!(c.status, EscrowStatus::Created);
    assert_eq!(c.amount, 1_000);

    f.client.fund_escrow(&id);
    assert_eq!(f.token.balance(&owner), 0);
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Funded);
}

#[test]
fn release_after_maturity_pays_principal_plus_yield() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Safe, &10, &200, &Map::new(&f.env));
    f.client.fund_escrow(&id);

    let admin_deposit = 10;
    f.token_admin.mint(&f.admin, &admin_deposit);
    f.client.deposit_yield_pool(&f.admin, &admin_deposit);

    // Advance ledger time past maturity.
    f.env.ledger().set_timestamp(11 * 86_400);
    let paid = f.client.release(&id, &owner);

    let commitment = f.client.get_commitment(&id);
    assert_eq!(commitment.accrued_yield, 1);
    assert_eq!(paid, 1_001);
    assert_eq!(f.token.balance(&owner), 1_001);
    assert_eq!(f.token.balance(&f.admin), 0);
    assert_eq!(f.client.get_yield_pool_balance(), 9);
    assert_eq!(commitment.status, EscrowStatus::Released);
}

#[test]
fn release_without_yield_pool_fails() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Safe, &10, &200);
    f.client.fund_escrow(&id);

    f.env.ledger().set_timestamp(11 * 86_400);
    let res = f.client.try_release(&id, &owner);
    assert_eq!(res, Err(Ok(Error::InsufficientYieldPool)));
}

#[test]
fn third_party_can_trigger_release_post_maturity() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let third = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Safe, &10, &200);
    f.client.fund_escrow(&id);

    // Advance ledger time past maturity so release becomes allowed.
    f.env.ledger().set_timestamp(11 * 86_400);

    // Invoke release as a third-party (not the owner). The call should
    // succeed, the owner should receive the funds, and the third-party
    // invoker should not receive any of the escrowed assets.
    let paid = f.client.release(&id);
    assert_eq!(paid, 1_000);
    assert_eq!(f.token.balance(&owner), 1_000);
    assert_eq!(f.token.balance(&third), 0);
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Released);
}

#[test]
fn release_before_maturity_fails() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Safe, &10, &200, &Map::new(&f.env));
    f.client.fund_escrow(&id);

    let res = f.client.try_release(&id);
    assert_eq!(res, Err(Ok(Error::NotMatured)));
}

#[test]
fn pause_blocks_create_fund_and_refund_but_allows_release() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    // Pause contract writes.
    f.client.pause();
    assert!(f.client.is_paused());

    assert_eq!(f.client.try_refund(&id), Err(Ok(Error::Paused)));

    // New writes are blocked while paused.
    let other = Address::generate(&f.env);
    let create_res = f.client.try_create_commitment(&other, &f.asset, &1_000, &RiskProfile::Safe, &30, &200);
    assert_eq!(create_res, Err(Ok(Error::Paused)));

    let fund_res = f.client.try_fund_escrow(&id);
    assert_eq!(fund_res, Err(Ok(Error::Paused)));

    // Mature release remains available while paused.
    f.env.ledger().set_timestamp(31 * 86_400);
    let paid = f.client.release(&id, &owner);
    assert_eq!(paid, 1_000);
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Released);

    // Admin can unpause and normal writes resume.
    f.client.unpause();
    assert!(!f.client.is_paused());
}

#[test]
fn pause_can_be_toggled_by_admin() {
    let f = setup();

    f.client.pause();
    assert!(f.client.is_paused());

    f.client.unpause();
    assert!(!f.client.is_paused());
}

#[test]
fn refund_applies_penalty_to_fee_recipient() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    // 5% penalty.
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Aggressive, &30, &500, &Map::new(&f.env));
    f.client.fund_escrow(&id);

    let refunded = f.client.refund(&id);
    assert_eq!(refunded, 950);
    assert_eq!(f.token.balance(&owner), 950);
    assert_eq!(f.token.balance(&f.fee_recipient), 50);
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Refunded);
}

#[test]
fn refund_within_grace_period_is_penalty_free() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    // Admin configures a 1-day penalty-free grace window.
    f.client.set_grace_period(&f.admin, &SECONDS_PER_DAY);

    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Aggressive, &30, &500);
    f.client.fund_escrow(&id);

    // Advance to the exact start of the grace window.
    f.env.ledger().set_timestamp(29 * SECONDS_PER_DAY);
    let refunded = f.client.refund(&id);

    assert_eq!(refunded, 1_000);
    assert_eq!(f.token.balance(&owner), 1_000);
    assert_eq!(f.token.balance(&f.fee_recipient), 0);
}

#[test]
fn refund_outside_grace_period_still_applies_penalty() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    f.client.set_grace_period(&f.admin, &SECONDS_PER_DAY);

    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Aggressive, &30, &500);
    f.client.fund_escrow(&id);

    // Advance to just before the grace window begins.
    f.env.ledger().set_timestamp(28 * SECONDS_PER_DAY);
    let refunded = f.client.refund(&id);

    assert_eq!(refunded, 950);
    assert_eq!(f.token.balance(&f.fee_recipient), 50);
}

#[test]
fn admin_can_set_and_get_grace_period() {
    let f = setup();
    assert_eq!(f.client.get_grace_period(), 0);

    f.client.set_grace_period(&f.admin, &SECONDS_PER_DAY);
    assert_eq!(f.client.get_grace_period(), SECONDS_PER_DAY);
}

#[test]
fn dispute_freezes_then_admin_resolves() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300, &Map::new(&f.env));
    f.client.fund_escrow(&id);

    f.client
        .dispute(&id, &owner, &String::from_str(&f.env, "value mismatch"));
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Disputed);

    // Release/refund are blocked while disputed.
    assert_eq!(
        f.client.try_refund(&id),
        Err(Ok(Error::InvalidState))
    );

    let paid = f.client.resolve_dispute(&id, &true);
    assert_eq!(paid, 1_000);
    assert_eq!(f.token.balance(&owner), 1_000);
}

#[test]
fn create_rejects_invalid_amount() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let res =
        f.client
            .try_create_commitment(&owner, &f.asset, &0, &RiskProfile::Safe, &30, &200, &Map::new(&f.env));
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn create_rejects_overflow_duration() {
    let f = setup();
    // Set timestamp close to max to cause overflow when adding duration
    f.env.ledger().set_timestamp(u64::MAX - 10);
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    // Use a duration that will overflow when added to current timestamp
    let res = f.client.try_create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Safe, &10u32, &2000u32);
    assert_eq!(res, Err(Ok(Error::InvalidDuration)));
}

#[test]
fn create_rejects_excessive_penalty() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let res = f.client.try_create_commitment(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &30,
        &20_000,
        &Map::new(&f.env),
    );
    assert_eq!(res, Err(Ok(Error::PenaltyTooHigh)));
}

#[test]
fn record_attestation_clamps_score() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let attestor = Address::generate(&f.env);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300, &Map::new(&f.env));
    f.client.record_attestation(&id, &attestor, &250);
    assert_eq!(f.client.get_commitment(&id).compliance_score, 100);
}

#[test]
fn owner_index_tracks_commitments() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let a = f
        .client
        .create_commitment(&owner, &f.asset, &100, &RiskProfile::Safe, &30, &200, &Map::new(&f.env));
    let b = f
        .client
        .create_commitment(&owner, &f.asset, &200, &RiskProfile::Balanced, &30, &300, &Map::new(&f.env));
    let ids = f.client.get_owner_commitments(&owner);
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0).unwrap(), a);
    assert_eq!(ids.get(1).unwrap(), b);
}

#[test]
fn create_rejects_excessive_amount() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let res = f.client.try_create_commitment(
        &owner,
        &f.asset,
        &(MAX_AMOUNT + 1),
        &RiskProfile::Safe,
        &30,
        &2000,
    );
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn create_rejects_excessive_duration() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let res = f.client.try_create_commitment(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &(MAX_DURATION_DAYS + 1),
        &2000,
    );
    assert_eq!(res, Err(Ok(Error::InvalidDuration)));
}

