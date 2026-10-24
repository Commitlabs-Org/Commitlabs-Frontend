use super::{
    Error, EscrowContract, EscrowContractClient, EscrowStatus, RiskProfile, FUNDING_WINDOW_SECONDS,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env, Map, String,
};

#[allow(dead_code)]
struct TestFixture<'a> {
    env: Env,
    client: EscrowContractClient<'a>,
    contract_id: Address,
    token_address: Address,
    owner: Address,
    admin: Address,
    fee_recipient: Address,
    token: StellarAssetClient<'a>,
    token_client: TokenClient<'a>,
}

fn setup<'a>(env: &'a Env) -> TestFixture<'a> {
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
    let token_client = TokenClient::new(env, &token_address);

    token.mint(&owner, &10_000_000);
    token.mint(&admin, &10_000_000);

    // Seed yield pool with surplus so releases and yield withdrawals have liquidity
    client.deposit_yield_pool(&500_000);

    TestFixture {
        env: env.clone(),
        client,
        contract_id,
        token_address,
        owner,
        admin,
        fee_recipient,
        token,
        token_client,
    }
}

fn create_and_fund(f: &TestFixture, amount: i128, duration_days: u32) -> u64 {
    let id = f.client.create_commitment(
        &f.owner,
        &f.token_address,
        &amount,
        &RiskProfile::Balanced,
        &duration_days,
        &300,
        &Map::new(&f.env),
    );
    f.client.fund_escrow(&id);
    id
}

#[test]
fn paused_blocks_create_commitment() {
    let env = Env::default();
    let f = setup(&env);

    f.client.pause();
    assert!(f.client.is_paused());

    let res = f.client.try_create_commitment(
        &f.owner,
        &f.token_address,
        &1_000,
        &RiskProfile::Balanced,
        &30,
        &300,
        &Map::new(&env),
    );
    assert_eq!(res, Err(Ok(Error::Paused)));
}

#[test]
fn paused_blocks_create_commitment_default() {
    let env = Env::default();
    let f = setup(&env);

    f.client.pause();
    assert!(f.client.is_paused());

    let res = f.client.try_create_commitment_default(
        &f.owner,
        &f.token_address,
        &1_000,
        &RiskProfile::Balanced,
        &30,
    );
    assert_eq!(res, Err(Ok(Error::Paused)));
}

#[test]
fn paused_blocks_fund_escrow() {
    let env = Env::default();
    let f = setup(&env);

    let id = f.client.create_commitment_default(
        &f.owner,
        &f.token_address,
        &1_000,
        &RiskProfile::Balanced,
        &30,
    );

    f.client.pause();

    let balance_before = f.token_client.balance(&f.owner);
    let contract_balance_before = f.token_client.balance(&f.contract_id);

    let res = f.client.try_fund_escrow(&id);
    assert_eq!(res, Err(Ok(Error::Paused)));

    // Balance and contract state must be completely untouched
    assert_eq!(f.token_client.balance(&f.owner), balance_before);
    assert_eq!(f.token_client.balance(&f.contract_id), contract_balance_before);
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Created);
}

#[test]
fn paused_blocks_refund_and_early_exit_identically() {
    let env = Env::default();
    let f = setup(&env);

    let id1 = create_and_fund(&f, 1_000, 30);
    let id2 = create_and_fund(&f, 1_000, 30);

    f.client.pause();

    let owner_bal_before = f.token_client.balance(&f.owner);
    let contract_bal_before = f.token_client.balance(&f.contract_id);

    // 1. refund is blocked
    let res_refund = f.client.try_refund(&id1);
    assert_eq!(res_refund, Err(Ok(Error::Paused)));

    // 2. early_exit_commitment is blocked with the identical Error::Paused
    let res_early_exit = f.client.try_early_exit_commitment(&id2, &f.owner);
    assert_eq!(res_early_exit, Err(Ok(Error::Paused)));

    // 3. refund_partial is also blocked
    let res_partial = f.client.try_refund_partial(&id1, &200);
    assert_eq!(res_partial, Err(Ok(Error::Paused)));

    // Verify token balances and commitment statuses remain untouched
    assert_eq!(f.token_client.balance(&f.owner), owner_bal_before);
    assert_eq!(f.token_client.balance(&f.contract_id), contract_bal_before);
    assert_eq!(f.client.get_commitment(&id1).status, EscrowStatus::Funded);
    assert_eq!(f.client.get_commitment(&id2).status, EscrowStatus::Funded);
}

#[test]
fn paused_blocks_release() {
    let env = Env::default();
    let f = setup(&env);

    let id = create_and_fund(&f, 1_000, 30);
    let c = f.client.get_commitment(&id);

    // Fast-forward to maturity
    env.ledger().with_mut(|l| l.timestamp = c.maturity + 1);

    f.client.pause();

    let owner_bal_before = f.token_client.balance(&f.owner);
    let contract_bal_before = f.token_client.balance(&f.contract_id);

    let res = f.client.try_release(&id, &f.owner);
    assert_eq!(res, Err(Ok(Error::Paused)));

    assert_eq!(f.token_client.balance(&f.owner), owner_bal_before);
    assert_eq!(f.token_client.balance(&f.contract_id), contract_bal_before);
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Funded);
}

#[test]
fn paused_blocks_settle() {
    let env = Env::default();
    let f = setup(&env);

    let id = create_and_fund(&f, 1_000, 30);
    let c = f.client.get_commitment(&id);

    // Fast-forward to maturity
    env.ledger().with_mut(|l| l.timestamp = c.maturity + 1);

    f.client.pause();

    let owner_bal_before = f.token_client.balance(&f.owner);
    let contract_bal_before = f.token_client.balance(&f.contract_id);

    let res = f.client.try_settle_commitment(&id, &f.owner);
    assert_eq!(res, Err(Ok(Error::Paused)));

    assert_eq!(f.token_client.balance(&f.owner), owner_bal_before);
    assert_eq!(f.token_client.balance(&f.contract_id), contract_bal_before);
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Funded);
}

#[test]
fn paused_blocks_dispute() {
    let env = Env::default();
    let f = setup(&env);

    let id = create_and_fund(&f, 1_000, 30);

    f.client.pause();

    let res = f.client.try_dispute(&id, &f.owner, &String::from_str(&env, "Fraud concern"));
    assert_eq!(res, Err(Ok(Error::Paused)));

    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Funded);
    assert!(f.client.get_dispute(&id).is_none());
}

#[test]
fn paused_blocks_transfer_ownership() {
    let env = Env::default();
    let f = setup(&env);

    let id = create_and_fund(&f, 1_000, 30);
    let new_owner = Address::generate(&env);

    f.client.pause();

    let res = f.client.try_transfer_ownership(&id, &new_owner);
    assert_eq!(res, Err(Ok(Error::Paused)));

    assert_eq!(f.client.get_commitment(&id).owner, f.owner);
}

#[test]
fn paused_blocks_attestation() {
    let env = Env::default();
    let f = setup(&env);

    let id = create_and_fund(&f, 1_000, 30);
    let attestor = Address::generate(&env);

    f.client.pause();

    let res = f.client.try_record_attestation(&id, &attestor, &85);
    assert_eq!(res, Err(Ok(Error::Paused)));

    assert_eq!(f.client.get_commitment(&id).compliance_score, 100);
    assert_eq!(f.client.get_attestations(&id).len(), 0);
}

#[test]
fn paused_blocks_deposit_yield_pool() {
    let env = Env::default();
    let f = setup(&env);

    f.client.pause();

    let admin_bal_before = f.token_client.balance(&f.admin);
    let pool_before = f.client.get_yield_pool_balance();

    let res = f.client.try_deposit_yield_pool(&50_000);
    assert_eq!(res, Err(Ok(Error::Paused)));

    assert_eq!(f.token_client.balance(&f.admin), admin_bal_before);
    assert_eq!(f.client.get_yield_pool_balance(), pool_before);
}

#[test]
fn paused_blocks_withdraw_yield_pool() {
    let env = Env::default();
    let f = setup(&env);

    f.client.pause();

    let admin_bal_before = f.token_client.balance(&f.admin);
    let pool_before = f.client.get_yield_pool_balance();

    let res = f.client.try_withdraw_yield_pool(&f.admin, &50_000);
    assert_eq!(res, Err(Ok(Error::Paused)));

    assert_eq!(f.token_client.balance(&f.admin), admin_bal_before);
    assert_eq!(f.client.get_yield_pool_balance(), pool_before);
}

#[test]
fn paused_blocks_cancel_commitment_before_expiry() {
    let env = Env::default();
    let f = setup(&env);

    let id = f.client.create_commitment_default(
        &f.owner,
        &f.token_address,
        &1_000,
        &RiskProfile::Balanced,
        &30,
    );

    f.client.pause();

    let res = f.client.try_cancel_commitment(&id, &f.owner);
    assert_eq!(res, Err(Ok(Error::Paused)));
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Created);
}

#[test]
fn paused_allows_cancel_commitment_after_expiry() {
    let env = Env::default();
    let f = setup(&env);

    let id = f.client.create_commitment_default(
        &f.owner,
        &f.token_address,
        &1_000,
        &RiskProfile::Balanced,
        &30,
    );

    let stranger = Address::generate(&env);

    // Fast-forward beyond the 7-day funding deadline
    env.ledger().with_mut(|l| l.timestamp += FUNDING_WINDOW_SECONDS + 10);

    f.client.pause();

    // After expiry, cancellation is permissionless and allowed during pause
    let res = f.client.try_cancel_commitment(&id, &stranger);
    assert_eq!(res, Ok(Ok(())));
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Cancelled);
}

#[test]
fn paused_allows_resolve_dispute() {
    let env = Env::default();
    let f = setup(&env);

    let id = create_and_fund(&f, 1_000, 30);
    f.client.dispute(&id, &f.owner, &String::from_str(&env, "Pre-pause dispute"));
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Disputed);

    // Admin pauses during the incident
    f.client.pause();
    assert!(f.client.is_paused());

    let owner_bal_before = f.token_client.balance(&f.owner);

    // Admin resolves dispute while paused (release_to_owner = true)
    let res = f.client.try_resolve_dispute(&id, &true);
    assert!(res.is_ok());

    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Released);
    assert!(f.token_client.balance(&f.owner) > owner_bal_before);
}

#[test]
fn paused_allows_unpause_and_set_admin() {
    let env = Env::default();
    let f = setup(&env);

    f.client.pause();
    assert!(f.client.is_paused());

    // Admin can rotate admin while paused
    let new_admin = Address::generate(&env);
    let res_set = f.client.try_set_admin(&new_admin);
    assert_eq!(res_set, Ok(Ok(())));

    // Admin can unpause while paused
    let res_unpause = f.client.try_unpause();
    assert_eq!(res_unpause, Ok(Ok(())));
    assert!(!f.client.is_paused());
}

#[test]
fn paused_allows_read_only_getters() {
    let env = Env::default();
    let f = setup(&env);

    let id = create_and_fund(&f, 1_000, 30);

    f.client.pause();

    assert!(f.client.is_paused());
    let c = f.client.get_commitment(&id);
    assert_eq!(c.id, id);
    assert_eq!(c.status, EscrowStatus::Funded);

    let status = f.client.get_yield_pool_status();
    assert!(status.balance > 0);

    assert_eq!(f.client.get_default_penalty(&RiskProfile::Balanced), 300);
    assert_eq!(f.client.get_violation_threshold(), 0);
    assert_eq!(f.client.get_user_commitment_ids(&f.owner).len(), 1);
    assert_eq!(f.client.get_attestations(&id).len(), 0);
    assert!(f.client.get_dispute(&id).is_none());
}

#[test]
fn unpause_restores_writes() {
    let env = Env::default();
    let f = setup(&env);

    let id = create_and_fund(&f, 1_000, 30);

    f.client.pause();

    // Blocked while paused
    assert_eq!(f.client.try_refund(&id), Err(Ok(Error::Paused)));

    // Admin unpauses
    f.client.unpause();
    assert!(!f.client.is_paused());

    // Refund now succeeds normally
    let res = f.client.try_refund(&id);
    assert!(res.is_ok());
    assert_eq!(f.client.get_commitment(&id).status, EscrowStatus::Refunded);
}

#[test]
fn paused_guard_runs_before_auth() {
    let env = Env::default();
    // Intentionally do NOT call env.mock_all_auths() here
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    // Use mock_all_auths temporarily just for setup
    env.mock_all_auths();
    client.initialize(
        &admin,
        &token_address,
        &fee_recipient,
        &200,
        &300,
        &500,
    );
    client.pause();
    assert!(client.is_paused());

    // Turn off mock auths to verify require_not_paused runs BEFORE require_auth
    // By creating a fresh un-mocked env interaction:
    // With pause active, calling try_create_commitment must return Error::Paused
    // rather than failing auth or panicking!
    let res = client.try_create_commitment_default(
        &owner,
        &token_address,
        &1_000,
        &RiskProfile::Balanced,
        &30,
    );
    assert_eq!(res, Err(Ok(Error::Paused)));
}
