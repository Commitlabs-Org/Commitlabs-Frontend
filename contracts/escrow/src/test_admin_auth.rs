#![cfg(test)]
extern crate std;

use crate::{EscrowContract, EscrowContractClient, Error, RiskProfile};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _, AuthorizedFunction, AuthorizedInvocation, MockAuth, MockAuthInvoke},
    Address, BytesN, Env, IntoVal, String, Symbol, Val,
};

fn setup() -> (Env, EscrowContractClient<'static>, Address, Address, Address, Address) {
    let env: &'static Env = std::boxed::Box::leak(std::boxed::Box::new(Env::default()));
    env.mock_all_auths();

    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(admin.clone());
    let attacker = Address::generate(&env);

    client.initialize(
        &admin,
        &token.address(),
        &fee_recipient,
        &200u32,
        &300u32,
        &500u32,
    );

    (env.clone(), client, admin, fee_recipient, token.address(), attacker)
}

#[test]
fn non_admin_cannot_set_grace_period() {
    let (env, client, _admin, _fee_recipient, _token, attacker) = setup();

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "set_grace_period",
            args: (7200u64,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_set_grace_period(&7200u64);
    assert!(result.is_err());
}

#[test]
fn admin_sets_grace_period() {
    let (env, client, admin, _fee_recipient, _token, _attacker) = setup();

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "set_grace_period",
            args: (7200u64,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_set_grace_period(&7200u64);
    assert_eq!(result, Ok(Ok(())));

    let grace = client.get_grace_period();
    assert_eq!(grace, 7200u64);
}

#[test]
fn grace_period_above_max_rejected() {
    let (_env, client, _admin, _fee_recipient, _token, _attacker) = setup();

    let max_seconds = 365u64 * 86_400u64;
    let too_large = max_seconds + 1;

    let result = client.try_set_grace_period(&too_large);
    assert_eq!(result, Err(Ok(Error::InvalidGracePeriod)));
}

#[test]
fn grace_period_at_max_accepted() {
    let (_env, client, _admin, _fee_recipient, _token, _attacker) = setup();

    let max_seconds = 365u64 * 86_400u64;

    let result = client.try_set_grace_period(&max_seconds);
    assert_eq!(result, Ok(Ok(())));

    let grace = client.get_grace_period();
    assert_eq!(grace, max_seconds);
}

#[test]
fn grace_period_zero_accepted() {
    let (_env, client, _admin, _fee_recipient, _token, _attacker) = setup();

    let result = client.try_set_grace_period(&0u64);
    assert_eq!(result, Ok(Ok(())));

    let grace = client.get_grace_period();
    assert_eq!(grace, 0u64);
}

#[test]
fn non_admin_cannot_deposit_yield_pool() {
    let (env, client, admin, _fee_recipient, token, attacker) = setup();

    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &token);
    let mint_amount = 10_000_000i128;
    token_admin_client.mint(&attacker, &mint_amount);

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "deposit_yield_pool",
            args: (1000i128,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_deposit_yield_pool(&1000i128);
    assert!(result.is_err());
}

#[test]
fn admin_deposits_yield_pool_moves_tokens() {
    let (env, client, admin, _fee_recipient, token, _attacker) = setup();

    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &token);
    let mint_amount = 10_000_000i128;
    token_admin_client.mint(&admin, &mint_amount);

    let before_balance = token_client.balance(&admin);
    let contract_balance_before = token_client.balance(&client.address);

    // deposit_yield_pool also needs the admin's auth for the nested token
    // transfer, so authorize the whole call tree.
    env.mock_all_auths();

    let result = client.try_deposit_yield_pool(&1000i128);
    assert_eq!(result, Ok(Ok(())));

    let after_balance = token_client.balance(&admin);
    let contract_balance_after = token_client.balance(&client.address);

    assert_eq!(before_balance - after_balance, 1000i128);
    assert_eq!(contract_balance_after - contract_balance_before, 1000i128);

    let pool_balance = client.get_yield_pool_balance();
    assert_eq!(pool_balance, 1000i128);
}

#[test]
fn non_admin_cannot_set_admin() {
    let (env, client, _admin, _fee_recipient, _token, attacker) = setup();
    let new_admin = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "set_admin",
            args: (new_admin.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_set_admin(&new_admin);
    assert!(result.is_err());
}

#[test]
fn non_admin_cannot_set_fee_recipient() {
    let (env, client, _admin, _fee_recipient, _token, attacker) = setup();
    let new_recipient = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "set_fee_recipient",
            args: (new_recipient.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_set_fee_recipient(&new_recipient);
    assert!(result.is_err());
}

#[test]
fn non_admin_cannot_pause() {
    let (env, client, _admin, _fee_recipient, _token, attacker) = setup();

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "pause",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_pause();
    assert!(result.is_err());
}

#[test]
fn non_admin_cannot_unpause() {
    let (env, client, admin, _fee_recipient, _token, attacker) = setup();

    // First pause as admin
    client.pause();
    assert!(client.is_paused());

    // Try unpause as attacker
    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "unpause",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_unpause();
    assert!(result.is_err());
}

#[test]
fn non_admin_cannot_set_violation_threshold() {
    let (env, client, _admin, _fee_recipient, _token, attacker) = setup();

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "set_violation_threshold",
            args: (50u32,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_set_violation_threshold(&50u32);
    assert!(result.is_err());
}

#[test]
fn non_admin_cannot_resolve_dispute() {
    let (env, client, admin, _fee_recipient, token, attacker) = setup();

    // Setup: create, fund, and dispute a commitment
    let owner = Address::generate(&env);
    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &token);
    token_admin_client.mint(&owner, &100_000i128);
    token_admin_client.mint(&admin, &10_000i128);

    client.deposit_yield_pool(&10_000i128);

    let commitment_id = client.create_commitment_default(
        &owner,
        &token,
        &1000i128,
        &RiskProfile::Safe,
        &30u32,
    );
    client.fund_escrow(&commitment_id);

    let reason = String::from_str(&env, "test dispute");
    client.dispute(&commitment_id, &owner, &reason);

    // Try resolve as attacker
    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "resolve_dispute",
            args: (commitment_id, true).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_resolve_dispute(&commitment_id, &true);
    assert!(result.is_err());
}

#[test]
fn non_admin_cannot_upgrade() {
    let (env, client, _admin, _fee_recipient, _token, attacker) = setup();

    let new_wasm_hash = BytesN::from_array(&env, &[1u8; 32]);

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "upgrade",
            args: (new_wasm_hash.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_upgrade(&new_wasm_hash);
    assert!(result.is_err());
}

#[test]
fn admin_can_set_admin() {
    let (env, client, admin, _fee_recipient, _token, _attacker) = setup();
    let new_admin = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "set_admin",
            args: (new_admin.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_set_admin(&new_admin);
    assert_eq!(result, Ok(Ok(())));
}

#[test]
fn admin_can_pause() {
    let (_env, client, _admin, _fee_recipient, _token, _attacker) = setup();

    let result = client.try_pause();
    assert_eq!(result, Ok(Ok(())));
    assert!(client.is_paused());
}

#[test]
fn admin_can_unpause() {
    let (_env, client, _admin, _fee_recipient, _token, _attacker) = setup();

    client.pause();
    let result = client.try_unpause();
    assert_eq!(result, Ok(Ok(())));
    assert!(!client.is_paused());
}

#[test]
fn admin_can_set_violation_threshold() {
    let (_env, client, _admin, _fee_recipient, _token, _attacker) = setup();

    let result = client.try_set_violation_threshold(&50u32);
    assert_eq!(result, Ok(Ok(())));

    let threshold = client.get_violation_threshold();
    assert_eq!(threshold, 50u32);
}

#[test]
fn old_admin_loses_access_after_set_admin() {
    let (env, client, old_admin, _fee_recipient, _token, _attacker) = setup();
    let new_admin = Address::generate(&env);

    // Transfer admin (two-step: propose, then accept)
    client.set_admin(&new_admin);
    client.accept_admin();

    // Old admin tries to pause
    env.mock_auths(&[MockAuth {
        address: &old_admin,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "pause",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_pause();
    assert!(result.is_err());

    // New admin can pause
    env.mock_auths(&[MockAuth {
        address: &new_admin,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "pause",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_pause();
    assert_eq!(result, Ok(Ok(())));
}
