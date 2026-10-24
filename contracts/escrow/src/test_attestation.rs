use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token, IntoVal,
};

struct AttestationFixture {
    env: Env,
    contract: Address,
    token: Address,
    admin: Address,
    owner: Address,
    attestor: Address,
    id: u64,
}

impl AttestationFixture {
    fn new() -> Self {
        let mut env = Env::default();
        env.set_config(soroban_sdk::testutils::EnvTestConfig {
            capture_snapshot_at_drop: false,
        });
        env.mock_all_auths();
        env.ledger().with_mut(|ledger| ledger.timestamp = 1_000);
        let admin = Address::generate(&env);
        let owner = Address::generate(&env);
        let attestor = Address::generate(&env);
        let fee = Address::generate(&env);
        let token = env
            .register_stellar_asset_contract_v2(admin.clone())
            .address();
        let contract = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(&env, &contract);
        client.initialize(&admin, &token, &fee, &200, &300, &500);

        let amount = 1_000_000;
        let pool = 100_000;
        let sac = token::StellarAssetClient::new(&env, &token);
        sac.mint(&owner, &amount);
        sac.mint(&admin, &(pool * 2));

        let id = client.create_commitment(
            &owner,
            &token,
            &amount,
            &RiskProfile::Balanced,
            &30,
            &300,
            &Map::new(&env),
        );
        client.deposit_yield_pool(&admin, &pool);
        client.fund_escrow(&id);
        env.mock_auths(&[]);

        Self {
            env,
            contract,
            token,
            admin,
            owner,
            attestor,
            id,
        }
    }

    fn client(&self) -> EscrowContractClient<'_> {
        EscrowContractClient::new(&self.env, &self.contract)
    }

    fn commitment(&self) -> Commitment {
        self.client().get_commitment(&self.id)
    }

    fn attestations(&self) -> Vec<AttestationRecord> {
        self.client().get_attestations(&self.id)
    }
}

#[test]
fn stranger_cannot_attest() {
    let f = AttestationFixture::new();
    let stranger = Address::generate(&f.env);

    f.env.mock_all_auths();
    let res = f.client().try_record_attestation(&f.id, &stranger, &80);
    assert_eq!(res, Err(Ok(Error::Unauthorized)));
    assert_eq!(f.attestations().len(), 0);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
    assert_eq!(f.commitment().compliance_score, 100);

    // Commitment owner without allowlist also cannot attest
    let owner_res = f.client().try_record_attestation(&f.id, &f.owner, &80);
    assert_eq!(owner_res, Err(Ok(Error::Unauthorized)));
    assert_eq!(f.attestations().len(), 0);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
    assert_eq!(f.commitment().compliance_score, 100);
}

#[test]
fn allowlisted_attestor_records_score() {
    let f = AttestationFixture::new();

    f.env.mock_all_auths();
    f.client().add_attestor(&f.attestor);
    assert!(f.client().is_attestor(&f.attestor));

    f.client().record_attestation(&f.id, &f.attestor, &85);
    assert_eq!(f.attestations().len(), 1);
    let att = f.attestations().get(0).unwrap();
    assert_eq!(att.attestor, f.attestor);
    assert_eq!(att.compliance_score, 85);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
    assert_eq!(f.commitment().compliance_score, 85);
}

#[test]
fn below_threshold_freezes_commitment() {
    let f = AttestationFixture::new();

    f.env.mock_all_auths();
    f.client().add_attestor(&f.attestor);
    f.client().set_violation_threshold(&70);

    f.client().record_attestation(&f.id, &f.attestor, &60);
    assert_eq!(f.attestations().len(), 1);
    assert_eq!(f.commitment().status, EscrowStatus::Violated);
    assert_eq!(f.commitment().compliance_score, 60);
}

#[test]
fn removed_attestor_rejected() {
    let f = AttestationFixture::new();

    f.env.mock_all_auths();
    f.client().add_attestor(&f.attestor);
    assert!(f.client().is_attestor(&f.attestor));

    f.client().remove_attestor(&f.attestor);
    assert!(!f.client().is_attestor(&f.attestor));

    let res = f.client().try_record_attestation(&f.id, &f.attestor, &90);
    assert_eq!(res, Err(Ok(Error::Unauthorized)));
    assert_eq!(f.attestations().len(), 0);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}

#[test]
fn non_admin_cannot_add_attestor() {
    let f = AttestationFixture::new();
    let stranger = Address::generate(&f.env);

    // Call without admin auth must fail
    f.env.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &f.contract,
            fn_name: "add_attestor",
            args: (f.attestor.clone(),).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);

    assert!(f.client().try_add_attestor(&f.attestor).is_err());
    assert!(!f.client().is_attestor(&f.attestor));

    // Admin can add attestor
    f.env.mock_auths(&[MockAuth {
        address: &f.admin,
        invoke: &MockAuthInvoke {
            contract: &f.contract,
            fn_name: "add_attestor",
            args: (f.attestor.clone(),).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);
    assert!(f.client().try_add_attestor(&f.attestor).is_ok());
    assert!(f.client().is_attestor(&f.attestor));

    f.env.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &f.contract,
            fn_name: "remove_attestor",
            args: (f.attestor.clone(),).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);

    assert!(f.client().try_remove_attestor(&f.attestor).is_err());
    assert!(f.client().is_attestor(&f.attestor));
    assert_eq!(f.attestations().len(), 0);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}

#[test]
fn attestation_on_terminal_commitment_rejected() {
    let f = AttestationFixture::new();
    f.env.mock_all_auths();
    f.client().add_attestor(&f.attestor);

    // 1. Created commitment (not yet funded)
    let amount = 500_000;
    let sac = token::StellarAssetClient::new(&f.env, &f.token);
    sac.mint(&f.owner, &amount);
    let created_id = f.client().create_commitment(
        &f.owner,
        &f.token,
        &amount,
        &RiskProfile::Safe,
        &14,
        &200,
        &Map::new(&f.env),
    );
    assert_eq!(f.client().get_commitment(&created_id).status, EscrowStatus::Created);
    let res_created = f.client().try_record_attestation(&created_id, &f.attestor, &90);
    assert_eq!(res_created, Err(Ok(Error::InvalidState)));
    assert_eq!(f.client().get_attestations(&created_id).len(), 0);
    assert_eq!(f.client().get_commitment(&created_id).status, EscrowStatus::Created);

    // 2. Released commitment
    let maturity = f.commitment().maturity;
    f.env
        .ledger()
        .with_mut(|ledger| ledger.timestamp = maturity);
    f.client().release(&f.id, &f.owner);
    assert_eq!(f.commitment().status, EscrowStatus::Released);
    let res_released = f.client().try_record_attestation(&f.id, &f.attestor, &90);
    assert_eq!(res_released, Err(Ok(Error::InvalidState)));
    assert_eq!(f.attestations().len(), 0);
    assert_eq!(f.commitment().status, EscrowStatus::Released);

    // 3. Refunded commitment
    let f2 = AttestationFixture::new();
    f2.env.mock_all_auths();
    f2.client().add_attestor(&f2.attestor);
    f2.client().refund(&f2.id);
    assert_eq!(f2.commitment().status, EscrowStatus::Refunded);
    let res_refunded = f2.client().try_record_attestation(&f2.id, &f2.attestor, &90);
    assert_eq!(res_refunded, Err(Ok(Error::InvalidState)));
    assert_eq!(f2.attestations().len(), 0);
    assert_eq!(f2.commitment().status, EscrowStatus::Refunded);
}

#[test]
fn score_is_clamped_to_100() {
    let f = AttestationFixture::new();
    f.env.mock_all_auths();
    f.client().add_attestor(&f.attestor);

    f.client().record_attestation(&f.id, &f.attestor, &150);
    assert_eq!(f.attestations().len(), 1);
    assert_eq!(f.attestations().get(0).unwrap().compliance_score, 100);
    assert_eq!(f.commitment().compliance_score, 100);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}

#[test]
fn attestor_allowlist_is_idempotent() {
    let f = AttestationFixture::new();
    f.env.mock_all_auths();

    // Adding already-present attestor
    f.client().add_attestor(&f.attestor);
    assert!(f.client().is_attestor(&f.attestor));
    f.client().add_attestor(&f.attestor);
    assert!(f.client().is_attestor(&f.attestor));

    // Removing absent attestor
    let unadded = Address::generate(&f.env);
    assert!(!f.client().is_attestor(&unadded));
    f.client().remove_attestor(&unadded);
    assert!(!f.client().is_attestor(&unadded));

    // Removing existing attestor
    f.client().remove_attestor(&f.attestor);
    assert!(!f.client().is_attestor(&f.attestor));
    f.client().remove_attestor(&f.attestor);
    assert!(!f.client().is_attestor(&f.attestor));
    assert_eq!(f.attestations().len(), 0);
    assert_eq!(f.commitment().status, EscrowStatus::Funded);
}
