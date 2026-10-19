use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token, IntoVal,
};

const PRINCIPAL: i128 = 1_000_000;
const POOL: i128 = 100_000;

#[test]
fn release_pays_current_owner_after_transfer() {
    let mut f = Fixture::new(PRINCIPAL, POOL);
    let old_owner = f.owner.clone();
    let new_owner = Address::generate(&f.env);
    f.env.mock_auths(&[MockAuth {
        address: &old_owner,
        invoke: &MockAuthInvoke {
            contract: &f.contract,
            fn_name: "transfer_ownership",
            args: (f.id, new_owner.clone()).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);
    f.client().transfer_ownership(&f.id, &new_owner);
    f.owner = new_owner;
    f.mature();
    let c = f.commitment();
    let before = f.balances();
    f.authorize("release", &old_owner);
    assert_eq!(
        f.client().try_release(&f.id, &old_owner),
        Err(Ok(Error::Unauthorized))
    );
    assert_eq!(f.balances(), before);
    f.authorize("release", &f.admin);
    let paid = f.client().release(&f.id, &f.admin);
    assert_eq!(paid, c.amount + c.accrued_yield);
    f.assert_paid(&before, paid, c.accrued_yield);
    assert_eq!(token::Client::new(&f.env, &f.token).balance(&old_owner), 0);
}

#[test]
fn frozen_commitments_cannot_be_released_or_settled() {
    for (status, error) in [
        (EscrowStatus::Disputed, Error::InvalidState),
        (EscrowStatus::Violated, Error::CommitmentViolated),
        (EscrowStatus::Created, Error::InvalidState),
        (EscrowStatus::Refunded, Error::InvalidState),
    ] {
        let f = Fixture::new(PRINCIPAL, POOL);
        f.mature();
        let mut c = f.commitment();
        c.status = status;
        f.set_commitment(&c);
        let before = f.balances();
        f.authorize("release", &f.owner);
        assert_eq!(f.client().try_release(&f.id, &f.owner), Err(Ok(error)));
        f.authorize("settle_commitment", &f.admin);
        assert_eq!(
            f.client().try_settle_commitment(&f.id, &f.admin),
            Err(Ok(error))
        );
        assert_eq!(f.balances(), before);
        assert_eq!(f.commitment().status, status);
    }
}

#[test]
fn failed_token_transfer_rolls_back_release() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    // Burn escrow liquidity while retaining its accounting to force the SAC transfer to fail.
    f.env.mock_all_auths();
    token::Client::new(&f.env, &f.token).burn(&f.contract, &PRINCIPAL);
    f.env.mock_auths(&[]);
    let before = f.balances();
    f.authorize("release", &f.owner);
    assert!(f.client().try_release(&f.id, &f.owner).is_err());
    assert_eq!(f.balances(), before);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}

#[test]
fn release_overflow_is_invalid_amount() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    let mut c = f.commitment();
    c.amount = i128::MAX;
    f.set_commitment(&c);
    let before = f.balances();
    f.authorize("release", &f.owner);
    assert_eq!(
        f.client().try_release(&f.id, &f.owner),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(f.balances(), before);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}

#[test]
fn settle_requires_admin_auth() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    let before = f.balances();
    assert!(matches!(
        f.client().try_settle_commitment(&f.id, &f.admin),
        Err(Err(_))
    ));
    assert_eq!(f.balances(), before);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}

#[test]
fn release_requires_owner_auth() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    let before = f.balances();
    assert!(matches!(
        f.client().try_release(&f.id, &f.owner),
        Err(Err(_))
    ));
    assert_eq!(f.balances(), before);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}

#[test]
fn settle_after_release_is_invalid_state() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    f.authorize("release", &f.owner);
    f.client().release(&f.id, &f.owner);
    let before = f.balances();
    f.authorize("settle_commitment", &f.owner);
    assert_eq!(
        f.client().try_settle_commitment(&f.id, &f.owner),
        Err(Ok(Error::InvalidState))
    );
    assert_eq!(f.balances(), before);
    assert_eq!(f.commitment().status, EscrowStatus::Released);
}

#[test]
fn settle_with_zero_yield_pays_principal() {
    let f = Fixture::new(1, 0);
    f.mature();
    assert_eq!(f.commitment().accrued_yield, 0);
    let before = f.balances();
    f.authorize("settle_commitment", &f.owner);
    let result = f.client().settle_commitment(&f.id, &f.owner);
    assert_eq!(result.settlement_amount, 1);
    f.assert_paid(&before, result.settlement_amount, 0);
}

#[test]
fn release_with_zero_yield_pays_principal() {
    let f = Fixture::new(1, 0);
    f.mature();
    assert_eq!(f.commitment().accrued_yield, 0);
    let before = f.balances();
    f.authorize("release", &f.owner);
    let paid = f.client().release(&f.id, &f.owner);
    assert_eq!(paid, 1);
    f.assert_paid(&before, paid, 0);
}


#[test]
fn settle_by_stranger_is_unauthorized() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    let stranger = Address::generate(&f.env);
    let before = f.balances();
    f.authorize("settle_commitment", &stranger);
    assert_eq!(
        f.client().try_settle_commitment(&f.id, &stranger),
        Err(Ok(Error::Unauthorized))
    );
    assert_eq!(f.balances(), before);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}

#[test]
fn settle_by_admin_pays_owner() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    let c = f.commitment();
    let before = f.balances();
    f.authorize("settle_commitment", &f.admin);
    let result = f.client().settle_commitment(&f.id, &f.admin);
    assert_eq!(result.settlement_amount, c.amount + c.accrued_yield);
    f.assert_paid(&before, result.settlement_amount, c.accrued_yield);
}

#[test]
fn release_before_maturity_not_matured() {
    let f = Fixture::new(PRINCIPAL, POOL);
    let before_maturity = f.commitment().maturity - 1;
    f.env
        .ledger()
        .with_mut(|ledger| ledger.timestamp = before_maturity);
    let before = f.balances();
    f.authorize("release", &f.owner);
    assert_eq!(
        f.client().try_release(&f.id, &f.owner),
        Err(Ok(Error::NotMatured))
    );
    assert_eq!(f.balances(), before);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}

#[test]
fn insufficient_yield_pool_is_rejected_atomically_at_funding() {
    // Since yield is reserved at funding time (see test_yield_reserve), an
    // under-funded pool is rejected by fund_escrow rather than at release.
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let fee = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let contract = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract);
    client.initialize(&admin, &token, &fee, &200, &300, &500);
    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&owner, &PRINCIPAL);
    sac.mint(&admin, &1);
    client.deposit_yield_pool(&admin, &1);
    let id = client.create_commitment(
        &owner,
        &token,
        &PRINCIPAL,
        &RiskProfile::Balanced,
        &30,
        &300,
        &Map::new(&env),
    );
    assert_eq!(
        client.try_fund_escrow(&id),
        Err(Ok(Error::InsufficientYieldPool))
    );
    let tc = token::Client::new(&env, &token);
    assert_eq!(tc.balance(&owner), PRINCIPAL);
    assert_eq!(tc.balance(&contract), 1);
    assert_eq!(client.get_commitment(&id).status, EscrowStatus::Created);
}

#[test]
fn double_release_is_invalid_state() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    f.authorize("release", &f.owner);
    f.client().release(&f.id, &f.owner);
    let before = f.balances();
    f.authorize("release", &f.owner);
    assert_eq!(
        f.client().try_release(&f.id, &f.owner),
        Err(Ok(Error::InvalidState))
    );
    assert_eq!(f.balances(), before);
    assert_eq!(f.commitment().status, EscrowStatus::Released);
}

#[test]
fn release_by_stranger_is_unauthorized() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    let stranger = Address::generate(&f.env);
    let before = f.balances();
    f.authorize("release", &stranger);
    assert_eq!(
        f.client().try_release(&f.id, &stranger),
        Err(Ok(Error::Unauthorized))
    );
    assert_eq!(f.balances(), before);
    assert_eq!(token::Client::new(&f.env, &f.token).balance(&stranger), 0);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}

#[test]
fn release_by_admin_pays_owner() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    let c = f.commitment();
    let before = f.balances();
    f.authorize("release", &f.admin);
    let paid = f.client().release(&f.id, &f.admin);
    assert_eq!(paid, c.amount + c.accrued_yield);
    f.assert_paid(&before, paid, c.accrued_yield);
}

#[test]
fn settle_pays_principal_plus_yield() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    let c = f.commitment();
    let before = f.balances();
    f.authorize("settle_commitment", &f.owner);
    let result = f.client().settle_commitment(&f.id, &f.owner);
    assert_eq!(result.settlement_amount, c.amount + c.accrued_yield);
    assert_eq!(result.final_status, String::from_str(&f.env, "SETTLED"));
    f.assert_paid(&before, result.settlement_amount, c.accrued_yield);
}

#[test]
fn release_pays_principal_plus_yield() {
    let f = Fixture::new(PRINCIPAL, POOL);
    f.mature();
    let c = f.commitment();
    let before = f.balances();
    f.authorize("release", &f.owner);
    let paid = f.client().release(&f.id, &f.owner);
    assert_eq!(paid, c.amount + c.accrued_yield);
    f.assert_paid(&before, paid, c.accrued_yield);
}

struct Fixture {
    env: Env,
    contract: Address,
    token: Address,
    owner: Address,
    admin: Address,
    fee: Address,
    id: u64,
}

#[derive(Debug, PartialEq, Eq)]
struct Balances {
    owner: i128,
    contract: i128,
    admin: i128,
    fee: i128,
    pool: i128,
}

impl Fixture {
    fn new(amount: i128, pool: i128) -> Self {
        let mut env = Env::default();
        env.set_config(soroban_sdk::testutils::EnvTestConfig {
            capture_snapshot_at_drop: false,
        });
        // Setup is independent of settlement authorization, which uses exact mocks below.
        env.mock_all_auths();
        env.ledger().with_mut(|ledger| ledger.timestamp = 1_000);
        let admin = Address::generate(&env);
        let owner = Address::generate(&env);
        let fee = Address::generate(&env);
        let token = env
            .register_stellar_asset_contract_v2(admin.clone())
            .address();
        let contract = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(&env, &contract);
        client.initialize(&admin, &token, &fee, &200, &300, &500);
        let sac = token::StellarAssetClient::new(&env, &token);
        sac.mint(&owner, &amount);
        sac.mint(&admin, &(POOL * 2));
        let id = client.create_commitment(
            &owner,
            &token,
            &amount,
            &RiskProfile::Balanced,
            &30,
            &300,
            &Map::new(&env),
        );
        // fund_escrow reserves the promised yield, so the pool is seeded first.
        if pool > 0 {
            client.deposit_yield_pool(&admin, &pool);
        }
        client.fund_escrow(&id);
        env.mock_auths(&[]);
        let fixture = Self {
            env,
            contract,
            token,
            owner,
            admin,
            fee,
            id,
        };
        assert_eq!(
            fixture.balances(),
            Balances {
                owner: 0,
                contract: amount + pool,
                admin: POOL * 2 - pool,
                fee: 0,
                pool,
            }
        );
        fixture
    }

    fn client(&self) -> EscrowContractClient<'_> {
        EscrowContractClient::new(&self.env, &self.contract)
    }

    fn commitment(&self) -> Commitment {
        self.client().get_commitment(&self.id)
    }

    fn mature(&self) {
        let maturity = self.commitment().maturity;
        self.env
            .ledger()
            .with_mut(|ledger| ledger.timestamp = maturity);
    }

    fn authorize(&self, method: &str, caller: &Address) {
        self.env.mock_auths(&[MockAuth {
            address: caller,
            invoke: &MockAuthInvoke {
                contract: &self.contract,
                fn_name: method,
                args: (self.id, caller.clone()).into_val(&self.env),
                sub_invokes: &[],
            },
        }]);
    }

    fn balances(&self) -> Balances {
        let token = token::Client::new(&self.env, &self.token);
        let pool = self.env.as_contract(&self.contract, || {
            self.env
                .storage()
                .instance()
                .get(&DataKey::YieldPool)
                .unwrap_or(0)
        });
        assert_eq!(pool, self.client().get_yield_pool_balance());
        Balances {
            owner: token.balance(&self.owner),
            contract: token.balance(&self.contract),
            admin: token.balance(&self.admin),
            fee: token.balance(&self.fee),
            pool,
        }
    }

    fn assert_paid(&self, before: &Balances, payout: i128, yield_amount: i128) {
        assert_eq!(
            self.balances(),
            Balances {
                owner: before.owner + payout,
                contract: before.contract - payout,
                admin: before.admin,
                fee: before.fee,
                pool: before.pool - yield_amount,
            }
        );
        assert_eq!(self.commitment().status, EscrowStatus::Released);
    }

    fn set_commitment(&self, commitment: &Commitment) {
        // Inject otherwise unreachable arithmetic/state edges without changing production APIs.
        self.env.as_contract(&self.contract, || {
            self.env
                .storage()
                .persistent()
                .set(&DataKey::Commitment(self.id), commitment);
        });
    }
}
