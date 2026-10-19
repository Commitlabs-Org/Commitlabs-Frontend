use super::{
    Commitment, DataKey, Error, EscrowContract, EscrowContractClient, EscrowStatus, RiskProfile,
    FUNDING_WINDOW_SECONDS, SECONDS_PER_DAY,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env, Map, String,
};

fn setup(
    env: &Env,
) -> (Address, Address, Address, Address, Address, StellarAssetClient<'_>) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let owner = Address::generate(env);
    let fee_recipient = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(env, &contract_id);
    client.initialize(
        &admin,
        &token_address,
        &fee_recipient,
        &200,
        &300,
        &500,
    );

    let token = StellarAssetClient::new(env, &token_address);
    token.mint(&owner, &1_000_000);
    (contract_id, token_address, owner, admin, fee_recipient, token)
}

fn create(
    client: &EscrowContractClient,
    env: &Env,
    owner: &Address,
    token: &Address,
    amount: i128,
    duration_days: u32,
    penalty_bps: u32,
) -> u64 {
    client.create_commitment(
        owner,
        token,
        &amount,
        &RiskProfile::Balanced,
        &duration_days,
        &penalty_bps,
        &Map::new(env),
    )
}

fn set_time(env: &Env, timestamp: u64) {
    env.ledger().with_mut(|ledger| ledger.timestamp = timestamp);
}

#[test]
fn late_funding_shifts_maturity_and_release_waits_for_shifted_date() {
    let env = Env::default();
    let (contract_id, token_address, owner, _, _, _) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);
    let t0 = 1_000;
    set_time(&env, t0);
    let commitment_id = create(&client, &env, &owner, &token_address, 1, 30, 0);

    let funding_time = t0 + 5 * SECONDS_PER_DAY;
    set_time(&env, funding_time);
    client.fund_escrow(&commitment_id);

    let commitment = client.get_commitment(&commitment_id);
    assert_eq!(commitment.maturity, t0 + 35 * SECONDS_PER_DAY);
    assert_eq!(commitment.maturity - funding_time, 30 * SECONDS_PER_DAY);

    set_time(&env, t0 + 30 * SECONDS_PER_DAY);
    assert_eq!(
        client.try_release(&commitment_id, &owner),
        Err(Ok(Error::NotMatured))
    );
}

#[test]
fn funding_window_includes_the_boundary_and_rejects_the_next_second() {
    let env = Env::default();
    let (contract_id, token_address, owner, _, _, token) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);
    let t0 = 5_000;
    set_time(&env, t0);
    let on_boundary = create(&client, &env, &owner, &token_address, 10, 30, 0);
    let after_boundary = create(&client, &env, &owner, &token_address, 10, 30, 0);

    set_time(&env, t0 + FUNDING_WINDOW_SECONDS);
    client.fund_escrow(&on_boundary);
    let owner_balance = token.balance(&owner);
    let contract_balance = token.balance(&contract_id);

    set_time(&env, t0 + FUNDING_WINDOW_SECONDS + 1);
    assert_eq!(
        client.try_fund_escrow(&after_boundary),
        Err(Ok(Error::FundingWindowExpired))
    );
    assert_eq!(token.balance(&owner), owner_balance);
    assert_eq!(token.balance(&contract_id), contract_balance);
}

#[test]
fn owner_and_expired_keeper_cancellation_update_status_index_and_no_balances() {
    let env = Env::default();
    let (contract_id, token_address, owner, _, _, token) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);
    let keeper = Address::generate(&env);
    let t0 = 10_000;
    set_time(&env, t0);
    let owner_cancelled = create(&client, &env, &owner, &token_address, 100, 30, 0);
    let keeper_cancelled = create(&client, &env, &owner, &token_address, 100, 30, 0);

    let owner_balance = token.balance(&owner);
    let contract_balance = token.balance(&contract_id);
    assert_eq!(
        client.try_cancel_commitment(&keeper_cancelled, &keeper),
        Err(Ok(Error::Unauthorized))
    );

    client.cancel_commitment(&owner_cancelled, &owner);
    assert_eq!(
        client.get_commitment(&owner_cancelled).status,
        EscrowStatus::Cancelled
    );
    let ids = client.get_user_commitment_ids(&owner);
    assert_eq!(ids.len(), 1);
    assert_eq!(ids.get(0), Some(keeper_cancelled));

    set_time(&env, t0 + FUNDING_WINDOW_SECONDS + 1);
    client.cancel_commitment(&keeper_cancelled, &keeper);
    assert_eq!(
        client.get_commitment(&keeper_cancelled).status,
        EscrowStatus::Cancelled
    );
    assert_eq!(client.get_user_commitment_ids(&owner).len(), 0);
    assert_eq!(token.balance(&owner), owner_balance);
    assert_eq!(token.balance(&contract_id), contract_balance);
}

#[test]
fn cancellation_rejects_every_non_created_status() {
    let env = Env::default();
    let (contract_id, token_address, owner, _, _, _) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);
    let attestor = Address::generate(&env);
    let t0 = 20_000;
    set_time(&env, t0);

    let funded = create(&client, &env, &owner, &token_address, 1, 30, 0);
    let released = create(&client, &env, &owner, &token_address, 1, 30, 0);
    let refunded = create(&client, &env, &owner, &token_address, 1, 30, 0);
    let disputed = create(&client, &env, &owner, &token_address, 1, 30, 0);
    let violated = create(&client, &env, &owner, &token_address, 1, 30, 0);
    for id in [funded, released, refunded, disputed, violated] {
        client.fund_escrow(&id);
    }

    client.refund(&refunded);
    client.dispute(&disputed, &owner, &String::from_str(&env, "test dispute"));
    client.set_violation_threshold(&90);
    client.record_attestation(&violated, &attestor, &10);

    let maturity = client.get_commitment(&released).maturity;
    set_time(&env, maturity);
    client.release(&released, &owner);

    for id in [funded, released, refunded, disputed, violated] {
        assert_eq!(
            client.try_cancel_commitment(&id, &owner),
            Err(Ok(Error::InvalidState))
        );
    }
}

#[test]
fn early_exit_after_old_maturity_still_applies_penalty_not_grace() {
    let env = Env::default();
    let (contract_id, token_address, owner, admin, fee_recipient, asset) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = TokenClient::new(&env, &token_address);
    let t0 = 30_000;
    set_time(&env, t0);
    client.set_grace_period(&admin, &SECONDS_PER_DAY);
    // fund_escrow reserves the promised yield up front, so the pool must cover it.
    asset.mint(&admin, &1_000);
    client.deposit_yield_pool(&admin, &1_000);
    let commitment_id = create(&client, &env, &owner, &token_address, 10_000, 30, 500);

    set_time(&env, t0 + 5 * SECONDS_PER_DAY);
    client.fund_escrow(&commitment_id);
    set_time(&env, t0 + 30 * SECONDS_PER_DAY + 1);

    assert_eq!(client.refund(&commitment_id), 9_500);
    assert_eq!(token.balance(&fee_recipient), 500);
    assert_eq!(
        client.get_commitment(&commitment_id).status,
        EscrowStatus::Refunded
    );
}

#[test]
fn existing_commitment_layout_still_uses_creation_maturity_to_derive_lock() {
    let env = Env::default();
    let (contract_id, token_address, owner, _, _, _) = setup(&env);
    let client = EscrowContractClient::new(&env, &contract_id);
    let t0 = 40_000;
    set_time(&env, t0);
    let id = create(&client, &env, &owner, &token_address, 1, 30, 0);

    let legacy: Commitment = env.as_contract(&contract_id, || {
        env.storage()
            .persistent()
            .get(&DataKey::Commitment(id))
            .unwrap()
    });
    assert_eq!(legacy.maturity - legacy.created_at, 30 * SECONDS_PER_DAY);
}
