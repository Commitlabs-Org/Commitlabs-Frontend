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
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Bytes, BytesN, Env, String,
};

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
    }
}

fn fund_owner(f: &Fixture, owner: &Address, amount: i128) {
    f.token_admin.mint(owner, &amount);
}

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
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
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
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Safe, &10, &200);
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
fn release_before_maturity_fails() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Safe, &10, &200);
    f.client.fund_escrow(&id);

    let res = f.client.try_release(&id, &owner);
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
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Aggressive, &30, &500);
    f.client.fund_escrow(&id);

    let refunded = f.client.refund(&id);
    assert_eq!(refunded, 950);
    assert_eq!(f.token.balance(&owner), 950);
    assert_eq!(f.token.balance(&f.fee_recipient), 50);
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Refunded);
}

#[test]
fn dispute_freezes_then_admin_resolves() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
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
            .try_create_commitment(&owner, &f.asset, &0, &RiskProfile::Safe, &30, &200);
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
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
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.record_attestation(&id, &attestor, &250);
    assert_eq!(f.client.get_commitment(&id).compliance_score, 100);
}

#[test]
fn owner_index_tracks_commitments() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let a = f
        .client
        .create_commitment(&owner, &f.asset, &100, &RiskProfile::Safe, &30, &200);
    let b = f
        .client
        .create_commitment(&owner, &f.asset, &200, &RiskProfile::Balanced, &30, &300);
    let ids = f.client.get_owner_commitments(&owner);
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0).unwrap(), a);
    assert_eq!(ids.get(1).unwrap(), b);
}

#[test]
fn dispute_categorizes_value_mismatch() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    // Test value mismatch keyword detection.
    f.client.dispute(
        &id,
        &owner,
        &String::from_str(&f.env, "actual value delivered was less than promised"),
    );

    let dispute = f.client.get_dispute(&id);
    assert!(dispute.is_some());
    let record = dispute.unwrap();
    assert_eq!(record.reason_category, DisputeReason::ValueMismatch);
    assert_eq!(record.disputed_by, owner);
}

#[test]
fn dispute_categorizes_non_compliance() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    f.client.dispute(
        &id,
        &owner,
        &String::from_str(&f.env, "compliance violation detected"),
    );

    let dispute = f.client.get_dispute(&id);
    assert!(dispute.is_some());
    let record = dispute.unwrap();
    assert_eq!(record.reason_category, DisputeReason::NonCompliance);
}

#[test]
fn dispute_categorizes_fraud_suspicion() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    f.client.dispute(
        &id,
        &owner,
        &String::from_str(&f.env, "suspicious fraud activity detected"),
    );

    let dispute = f.client.get_dispute(&id);
    assert!(dispute.is_some());
    let record = dispute.unwrap();
    assert_eq!(record.reason_category, DisputeReason::FraudSuspicion);
}

#[test]
fn dispute_categorizes_operational_failure() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    f.client.dispute(
        &id,
        &owner,
        &String::from_str(&f.env, "operational failure in delivery"),
    );

    let dispute = f.client.get_dispute(&id);
    assert!(dispute.is_some());
    let record = dispute.unwrap();
    assert_eq!(record.reason_category, DisputeReason::OperationalFailure);
}

#[test]
fn dispute_categorizes_other_reason() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    f.client.dispute(
        &id,
        &owner,
        &String::from_str(&f.env, "some unspecified reason"),
    );

    let dispute = f.client.get_dispute(&id);
    assert!(dispute.is_some());
    let record = dispute.unwrap();
    assert_eq!(record.reason_category, DisputeReason::Other);
}

#[test]
fn get_dispute_returns_persisted_reason_text() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    let reason_text = String::from_str(&f.env, "detailed explanation of the issue");
    f.client.dispute(&id, &owner, &reason_text);

    let dispute = f.client.get_dispute(&id);
    assert!(dispute.is_some());
    let record = dispute.unwrap();
    assert_eq!(record.reason_text, reason_text);
}

#[test]
fn dispute_stores_timestamp_and_initiator() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let initiator = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    let initial_timestamp = f.env.ledger().timestamp();
    f.client.dispute(
        &id,
        &initiator,
        &String::from_str(&f.env, "value mismatch"),
    );

    let dispute = f.client.get_dispute(&id);
    assert!(dispute.is_some());
    let record = dispute.unwrap();
    assert_eq!(record.disputed_by, initiator);
    assert!(record.disputed_at >= initial_timestamp);
}

#[test]
fn get_dispute_returns_none_for_undisputed_commitment() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    let dispute = f.client.get_dispute(&id);
    assert!(dispute.is_none());
}

#[test]
fn admin_can_open_dispute() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    // Admin initiates dispute.
    f.client.dispute(
        &id,
        &f.admin,
        &String::from_str(&f.env, "value mismatch"),
    );

    let dispute = f.client.get_dispute(&id);
    assert!(dispute.is_some());
    let record = dispute.unwrap();
    assert_eq!(record.disputed_by, f.admin);
}

#[test]
fn dispute_reason_case_insensitive() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    f.client.dispute(
        &id,
        &owner,
        &String::from_str(&f.env, "COMPLIANCE VIOLATION DETECTED"),
    );

    let dispute = f.client.get_dispute(&id);
    assert!(dispute.is_some());
    let record = dispute.unwrap();
    assert_eq!(record.reason_category, DisputeReason::NonCompliance);
}

#[test]
fn resolve_dispute_preserves_dispute_record() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    let id = f
        .client
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300);
    f.client.fund_escrow(&id);

    let reason = String::from_str(&f.env, "value mismatch issue");
    f.client.dispute(&id, &owner, &reason);

    // Dispute record should exist before resolution.
    let dispute_before = f.client.get_dispute(&id);
    assert!(dispute_before.is_some());

    // Admin resolves the dispute.
    f.client.resolve_dispute(&id, &true);

    // Dispute record should still be accessible after resolution.
    let dispute_after = f.client.get_dispute(&id);
    assert!(dispute_after.is_some());
    let record = dispute_after.unwrap();
    assert_eq!(record.reason_text, reason);
    assert_eq!(record.reason_category, DisputeReason::ValueMismatch);
}

#[test]
fn get_default_penalty_returns_configured_values() {
    let f = setup();
    
    // Verify all three default penalties are correctly configured.
    let safe_default = f.client.get_default_penalty(&RiskProfile::Safe);
    assert_eq!(safe_default, 200); // 2%
    
    let balanced_default = f.client.get_default_penalty(&RiskProfile::Balanced);
    assert_eq!(balanced_default, 300); // 3%
    
    let aggressive_default = f.client.get_default_penalty(&RiskProfile::Aggressive);
    assert_eq!(aggressive_default, 500); // 5%
}

#[test]
fn create_commitment_with_default_penalty_safe() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    // Create with default penalty for Safe profile (2%).
    let id = f.client.create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &30,
    );

    let commitment = f.client.get_commitment(&id);
    assert_eq!(commitment.penalty_bps, 200); // 2%
    assert_eq!(commitment.risk, RiskProfile::Safe);
}

#[test]
fn create_commitment_with_default_penalty_balanced() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    // Create with default penalty for Balanced profile (3%).
    let id = f.client.create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Balanced,
        &30,
    );

    let commitment = f.client.get_commitment(&id);
    assert_eq!(commitment.penalty_bps, 300); // 3%
    assert_eq!(commitment.risk, RiskProfile::Balanced);
}

#[test]
fn create_commitment_with_default_penalty_aggressive() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    // Create with default penalty for Aggressive profile (5%).
    let id = f.client.create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Aggressive,
        &30,
    );

    let commitment = f.client.get_commitment(&id);
    assert_eq!(commitment.penalty_bps, 500); // 5%
    assert_eq!(commitment.risk, RiskProfile::Aggressive);
}

#[test]
fn create_commitment_explicit_override_ignores_default() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    // Create with explicit penalty that differs from default.
    // Safe default is 200 (2%), but explicitly set 100 (1%).
    let id = f.client.create_commitment(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &30,
        &100, // 1% explicit override
    );

    let commitment = f.client.get_commitment(&id);
    assert_eq!(commitment.penalty_bps, 100); // Uses explicit override, not default
    assert_eq!(commitment.risk, RiskProfile::Safe);
}

#[test]
fn refund_with_default_penalty_safe_applies_correct_fee() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    // Create commitment with Safe default penalty (2%).
    let id = f.client.create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &30,
    );
    f.client.fund_escrow(&id);

    let refunded = f.client.refund(&id);
    // 1000 * 200 / 10000 = 20 penalty
    assert_eq!(refunded, 980);
    assert_eq!(f.token.balance(&f.fee_recipient), 20);
}

#[test]
fn refund_with_default_penalty_balanced_applies_correct_fee() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    // Create commitment with Balanced default penalty (3%).
    let id = f.client.create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Balanced,
        &30,
    );
    f.client.fund_escrow(&id);

    let refunded = f.client.refund(&id);
    // 1000 * 300 / 10000 = 30 penalty
    assert_eq!(refunded, 970);
    assert_eq!(f.token.balance(&f.fee_recipient), 30);
}

#[test]
fn refund_with_default_penalty_aggressive_applies_correct_fee() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    // Create commitment with Aggressive default penalty (5%).
    let id = f.client.create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Aggressive,
        &30,
    );
    f.client.fund_escrow(&id);

    let refunded = f.client.refund(&id);
    // 1000 * 500 / 10000 = 50 penalty
    assert_eq!(refunded, 950);
    assert_eq!(f.token.balance(&f.fee_recipient), 50);
}

#[test]
fn multiple_commitments_different_profiles_use_correct_defaults() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 10_000);

    // Create three commitments with different risk profiles.
    let safe_id = f.client.create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &30,
    );
    
    let balanced_id = f.client.create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Balanced,
        &30,
    );
    
    let aggressive_id = f.client.create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Aggressive,
        &30,
    );

    let safe_c = f.client.get_commitment(&safe_id);
    let balanced_c = f.client.get_commitment(&balanced_id);
    let aggressive_c = f.client.get_commitment(&aggressive_id);

    assert_eq!(safe_c.penalty_bps, 200);
    assert_eq!(balanced_c.penalty_bps, 300);
    assert_eq!(aggressive_c.penalty_bps, 500);
}

#[test]
fn create_commitment_with_default_validates_amount() {
    let f = setup();
    let owner = Address::generate(&f.env);
    
    // Attempt to create with invalid amount.
    let res = f.client.try_create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &0, // Invalid: amount must be > 0
        &RiskProfile::Safe,
        &30,
    );
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn create_commitment_with_default_validates_duration() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    
    // Attempt to create with invalid duration.
    let res = f.client.try_create_commitment_with_default_penalty(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &0, // Invalid: duration must be > 0
    );
    assert_eq!(res, Err(Ok(Error::InvalidDuration)));
}

#[test]
fn initialize_validates_penalty_limits() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let asset = sac.address();
    
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    
    // Attempt to initialize with penalty exceeding MAX_PENALTY_BPS (10000).
    let res = client.try_initialize(
        &admin,
        &asset,
        &fee_recipient,
        &200,     // Safe: valid
        &300,     // Balanced: valid
        &20_000,  // Aggressive: INVALID (> 10000)
    );
    assert_eq!(res, Err(Ok(Error::PenaltyTooHigh)));
}

#[test]
fn explicit_penalty_override_zero_is_valid() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    // Create with explicit 0% penalty (allowed for override).
    let id = f.client.create_commitment(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Balanced,
        &30,
        &0, // 0% explicit penalty
    );

    let commitment = f.client.get_commitment(&id);
    assert_eq!(commitment.penalty_bps, 0);
    
    // Fund and refund should return full amount.
    f.client.fund_escrow(&id);
    let refunded = f.client.refund(&id);
    assert_eq!(refunded, 1_000); // No penalty deducted
}
