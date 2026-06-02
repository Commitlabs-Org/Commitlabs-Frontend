use super::*;
use soroban_sdk::{
    testutils::{storage::Persistent as _, Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, Map, String, Symbol, TryFromVal, Val, Vec,
};

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
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let asset = sac.address();
    let token = TokenClient::new(&env, &asset);
    let token_admin = StellarAssetClient::new(&env, &asset);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &asset, &fee_recipient, &200u32, &300u32, &500u32);

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

fn expected_ttl_for_maturity(env: &Env, maturity: u64) -> u32 {
    let remaining_seconds = maturity.saturating_sub(env.ledger().timestamp());
    let remaining_ledgers =
        (remaining_seconds.saturating_add(ESTIMATED_LEDGER_SECONDS - 1)) / ESTIMATED_LEDGER_SECONDS;
    let target = remaining_ledgers.saturating_add(TTL_MATURITY_BUFFER_LEDGERS as u64);
    core::cmp::min(target, env.storage().max_ttl() as u64) as u32
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
// ── Existing lifecycle tests (unchanged) ─────────────────────────────────────

#[test]
fn initialize_is_one_time() {
    let f = setup();
    let other = Address::generate(&f.env);
    let res = f
        .client
        .try_initialize(&f.admin, &f.asset, &other, &200, &300, &500);
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
        &f.contract_id,
        "create_commitment",
        &owner,
        id,
        CreateCommitmentEventData {
            asset: f.asset.clone(),
            amount: 1_000,
            risk: RiskProfile::Balanced,
            maturity: 30 * 86_400,
            penalty_bps: 300,
        },
    );
}

#[test]
fn default_penalty_creation_keeps_create_commitment_event_name() {
    let f = setup();
    let owner = Address::generate(&f.env);

    let id = f.client.create_commitment_with_default(
        &owner,
        &f.asset,
        &2_000i128,
        &RiskProfile::Safe,
        &15u32,
    );

    assert_contract_event(
        &f.env,
        &f.contract_id,
        "create_commitment",
        &owner,
        id,
        CreateCommitmentEventData {
            asset: f.asset.clone(),
            amount: 2_000,
            risk: RiskProfile::Safe,
            maturity: 15 * 86_400,
            penalty_bps: 200,
        },
    );
}

#[test]
fn fund_escrow_emits_stable_indexable_event() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    let id = f.client.create_commitment(
        &owner,
        &f.asset,
        &1_000i128,
        &RiskProfile::Balanced,
        &30u32,
        &300u32,
        &metadata(&f.env),
    );
    f.client.fund_escrow(&id);

    assert_contract_event(
        &f.env,
        &f.contract_id,
        "fund_escrow",
        &owner,
        id,
        FundEscrowEventData {
            asset: f.asset.clone(),
            amount: 1_000,
            risk: RiskProfile::Balanced,
        },
    );
    assert_eq!(f.token.balance(&owner), 0);
}

#[test]
fn release_emits_stable_indexable_event() {
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
    let paid = f.client.release(&id);

    let id = f.client.create_commitment(
        &owner,
        &f.asset,
        &1_000i128,
        &RiskProfile::Aggressive,
        &10u32,
        &500u32,
        &metadata(&f.env),
    );
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
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Safe, &10, &200, &Map::new(&f.env));
    f.client.fund_escrow(&id);

    f.env.ledger().set_timestamp(11 * 86_400);
    let res = f.client.try_release(&id);
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
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Safe, &10, &200, &Map::new(&f.env));
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
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Balanced, &30, &300, &Map::new(&f.env));
    f.client.fund_escrow(&id);

    // Pause contract writes.
    f.client.pause();
    assert!(f.client.is_paused());

    assert_eq!(f.client.try_refund(&id), Err(Ok(Error::Paused)));

    // New writes are blocked while paused.
    let other = Address::generate(&f.env);
    let create_res = f.client.try_create_commitment(
        &other,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &30,
        &200,
        &Map::new(&f.env),
    );
    assert_eq!(create_res, Err(Ok(Error::Paused)));

    let fund_res = f.client.try_fund_escrow(&id);
    assert_eq!(fund_res, Err(Ok(Error::Paused)));

    // Mature release remains available while paused.
    f.env.ledger().set_timestamp(31 * 86_400);
    let paid = f.client.release(&id);
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
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Aggressive, &30, &500, &Map::new(&f.env));
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
        .create_commitment(&owner, &f.asset, &1_000, &RiskProfile::Aggressive, &30, &500, &Map::new(&f.env));
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

    f.token_admin.mint(&f.admin, &commitment.accrued_yield);
    f.client
        .deposit_yield_pool(&f.admin, &commitment.accrued_yield);
    f.env.ledger().set_timestamp(commitment.maturity);

    let payout = f.client.release(&id);
    assert_eq!(payout, commitment.amount + commitment.accrued_yield);

    assert_contract_event(
        &f.env,
        &f.contract_id,
        "release",
        &owner,
        id,
        ReleaseEventData {
            asset: f.asset.clone(),
            amount: commitment.amount,
            accrued_yield: commitment.accrued_yield,
            payout,
            risk: RiskProfile::Aggressive,
        },
    );
}

#[test]
fn refund_emits_stable_indexable_event() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);
    // Use a duration that will overflow when added to current timestamp
    let res = f.client.try_create_commitment(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &10u32,
        &2000u32,
        &Map::new(&f.env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidDuration)));
}

    let id = f.client.create_commitment(
        &owner,
        &f.asset,
        &1_000i128,
        &RiskProfile::Aggressive,
        &30u32,
        &500u32,
        &metadata(&f.env),
    );
    f.client.fund_escrow(&id);

    let refunded_amount = f.client.refund(&id);
    assert_eq!(refunded_amount, 950);

    assert_contract_event(
        &f.env,
        &f.contract_id,
        "refund",
        &owner,
        id,
        RefundEventData {
            asset: f.asset.clone(),
            amount: 1_000,
            refunded_amount: 950,
            penalty: 50,
            risk: RiskProfile::Aggressive,
        },
    );
    assert_eq!(f.token.balance(&f.fee_recipient), 50);
}

#[test]
fn dispute_emits_stable_indexable_event() {
    let f = setup();
    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

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
    let ids = f
        .client
        .get_owner_commitments(&owner, &0, &MAX_OWNER_COMMITMENTS_PAGE_LIMIT);
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0).unwrap(), a);
    assert_eq!(ids.get(1).unwrap(), b);
}

#[test]
fn get_owner_commitments_pages_results() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let mut created_ids = Vec::new(&f.env);

    for index in 0..5 {
        let id = f.client.create_commitment(
            &owner,
            &f.asset,
            &(100 + index as i128),
            &RiskProfile::Safe,
            &30,
            &200,
            &Map::new(&f.env),
        );
        created_ids.push_back(id);
    }

    let page = f.client.get_owner_commitments(&owner, &1, &2);

    assert_eq!(page.len(), 2);
    assert_eq!(page.get(0).unwrap(), created_ids.get(1).unwrap());
    assert_eq!(page.get(1).unwrap(), created_ids.get(2).unwrap());
}

#[test]
fn get_owner_commitments_caps_limit_and_handles_boundaries() {
    let f = setup();
    let owner = Address::generate(&f.env);

    for index in 0..(MAX_OWNER_COMMITMENTS_PAGE_LIMIT + 5) {
        f.client.create_commitment(
            &owner,
            &f.asset,
            &(100 + index as i128),
            &RiskProfile::Safe,
            &30,
            &200,
            &Map::new(&f.env),
        );
    }

    let capped = f.client.get_owner_commitments(
        &owner,
        &0,
        &(MAX_OWNER_COMMITMENTS_PAGE_LIMIT + 5),
    );
    let tail = f.client.get_owner_commitments(
        &owner,
        &MAX_OWNER_COMMITMENTS_PAGE_LIMIT,
        &10,
    );
    let empty_limit = f.client.get_owner_commitments(&owner, &0, &0);
    let out_of_range = f.client.get_owner_commitments(
        &owner,
        &(MAX_OWNER_COMMITMENTS_PAGE_LIMIT + 5),
        &10,
    );

    assert_eq!(capped.len(), MAX_OWNER_COMMITMENTS_PAGE_LIMIT);
    assert_eq!(
        capped.get(MAX_OWNER_COMMITMENTS_PAGE_LIMIT - 1).unwrap(),
        MAX_OWNER_COMMITMENTS_PAGE_LIMIT as u64 - 1
    );
    assert_eq!(tail.len(), 5);
    assert_eq!(tail.get(0).unwrap(), MAX_OWNER_COMMITMENTS_PAGE_LIMIT as u64);
    assert_eq!(tail.get(4).unwrap(), MAX_OWNER_COMMITMENTS_PAGE_LIMIT as u64 + 4);
    assert_eq!(empty_limit.len(), 0);
    assert_eq!(out_of_range.len(), 0);
}

#[test]
fn get_user_commitments_returns_full_records() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let first_id = f.client.create_commitment(
        &owner,
        &f.asset,
        &100,
        &RiskProfile::Safe,
        &30,
        &200,
        &Map::new(&f.env),
    );
    let second_id = f.client.create_commitment(
        &owner,
        &f.asset,
        &250,
        &RiskProfile::Balanced,
        &45,
        &300,
        &Map::new(&f.env),
    );

    let commitments = f.client.get_user_commitments(&owner);

    assert_eq!(commitments.len(), 2);

    let first = commitments.get(0).unwrap();
    assert_eq!(first.id, first_id);
    assert_eq!(first.owner, owner);
    assert_eq!(first.amount, 100);
    assert_eq!(first.status, EscrowStatus::Created);

    let second = commitments.get(1).unwrap();
    assert_eq!(second.id, second_id);
    assert_eq!(second.owner, owner);
    assert_eq!(second.amount, 250);
    assert_eq!(second.status, EscrowStatus::Created);
}

#[test]
fn get_user_commitments_is_bounded() {
    let f = setup();
    let owner = Address::generate(&f.env);

    for index in 0..(MAX_USER_COMMITMENTS_READ + 5) {
        let amount = 100 + index as i128;
        f.client.create_commitment(
            &owner,
            &f.asset,
            &amount,
            &RiskProfile::Safe,
            &30,
            &200,
            &Map::new(&f.env),
        );
    }

    let commitments = f.client.get_user_commitments(&owner);
    let ids = f.client.get_user_commitment_ids_page(
        &owner,
        &0,
        &(MAX_USER_COMMITMENTS_READ + 5),
    );

    assert_eq!(commitments.len(), MAX_USER_COMMITMENTS_READ);
    assert_eq!(ids.len(), MAX_OWNER_COMMITMENTS_PAGE_LIMIT);
    assert_eq!(commitments.get(0).unwrap().id, ids.get(0).unwrap());
    assert_eq!(
        commitments
            .get(MAX_USER_COMMITMENTS_READ - 1)
            .unwrap()
            .id,
        ids.get(MAX_USER_COMMITMENTS_READ - 1).unwrap()
    );
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
        &Map::new(&f.env),
    );
    f.client.fund_escrow(&id);

    let reason = String::from_str(&f.env, "value mismatch during settlement");
    f.client.dispute(&id, &owner, &reason);

    assert_contract_event(
        &f.env,
        &f.contract_id,
        "dispute",
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &(MAX_DURATION_DAYS + 1),
        &2000,
        &Map::new(&f.env),
    );
}

#[test]
fn create_bumps_commitment_and_owner_index_ttl_to_maturity() {
    let f = setup();
    f.env.ledger().set_sequence_number(100);
    f.env.ledger().set_timestamp(0);
    f.env.ledger().set_min_persistent_entry_ttl(16);
    f.env.ledger().set_max_entry_ttl(20_000);

    let owner = Address::generate(&f.env);
    let id = f.client.create_commitment(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Safe,
        &1,
        &200,
        &Map::new(&f.env),
    );
    let commitment = f.client.get_commitment(&id);
    let expected_ttl = expected_ttl_for_maturity(&f.env, commitment.maturity);
    let commitment_ttl = f
        .env
        .as_contract(&f.contract_id, || f.env.storage().persistent().get_ttl(&DataKey::Commitment(id)));
    let owner_index_ttl = f.env.as_contract(&f.contract_id, || {
        f.env
            .storage()
            .persistent()
            .get_ttl(&DataKey::OwnerIndex(owner.clone()))
    });

    assert_eq!(commitment_ttl, expected_ttl);
    assert_eq!(owner_index_ttl, expected_ttl);
}

#[test]
fn fund_mutation_refreshes_commitment_ttl_when_it_falls_behind_maturity() {
    let f = setup();
    f.env.ledger().set_sequence_number(100);
    f.env.ledger().set_timestamp(0);
    f.env.ledger().set_min_persistent_entry_ttl(16);
    f.env.ledger().set_max_entry_ttl(25_000);

    let owner = Address::generate(&f.env);
    fund_owner(&f, &owner, 1_000);

    let id = f.client.create_commitment(
        &owner,
        &f.asset,
        &1_000,
        &RiskProfile::Balanced,
        &1,
        &300,
        &Map::new(&f.env),
    );

    f.env.ledger().set_sequence_number(9_100);
    f.env.ledger().set_timestamp(500);

    f.client.fund_escrow(&id);

    let maturity = f.client.get_commitment(&id).maturity;
    let expected_ttl = expected_ttl_for_maturity(&f.env, maturity);
    let commitment_ttl = f
        .env
        .as_contract(&f.contract_id, || f.env.storage().persistent().get_ttl(&DataKey::Commitment(id)));
    assert_eq!(commitment_ttl, expected_ttl);
}

#[test]
fn owner_index_ttl_tracks_the_latest_commitment_maturity() {
    let f = setup();
    f.env.ledger().set_sequence_number(100);
    f.env.ledger().set_timestamp(0);
    f.env.ledger().set_min_persistent_entry_ttl(16);
    f.env.ledger().set_max_entry_ttl(40_000);

    let owner = Address::generate(&f.env);
    f.client.create_commitment(
        &owner,
        &f.asset,
        &100,
        &RiskProfile::Safe,
        &1,
        &200,
        &Map::new(&f.env),
    );
    let long_id = f.client.create_commitment(
        &owner,
        &f.asset,
        &200,
        &RiskProfile::Balanced,
        &2,
        &300,
        &Map::new(&f.env),
    );

    let long_commitment = f.client.get_commitment(&long_id);
    let expected_ttl = expected_ttl_for_maturity(&f.env, long_commitment.maturity);
    let owner_index_ttl = f
        .env
        .as_contract(&f.contract_id, || f.env.storage().persistent().get_ttl(&DataKey::OwnerIndex(owner)));
    assert_eq!(owner_index_ttl, expected_ttl);
}
