#![cfg(test)]

use crate::{EscrowContract, EscrowContractClient, Error, RiskProfile};
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal, String,
};

fn setup() -> (Env, EscrowContractClient, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(admin.clone());

    client.initialize(
        &admin,
        &token.address(),
        &fee_recipient,
        &200u32,
        &300u32,
        &500u32,
    );

    (env, client, admin, fee_recipient, token.address())
}

// ══════════════════════════════════════════════════════════════════════════
//  Admin Two-Step Tests
// ══════════════════════════════════════════════════════════════════════════

#[test]
fn admin_propose_and_accept() {
    let (env, client, admin, _fee_recipient, _token) = setup();
    let new_admin = Address::generate(&env);

    // Propose
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "propose_admin",
            args: (new_admin.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.propose_admin(&new_admin);
    assert_eq!(result, Ok(()));

    // Check pending
    let pending = client.get_pending_admin();
    assert_eq!(pending, Some(new_admin.clone()));

    // Admin is still the old one
    let current_admin = client.get_admin();
    assert_eq!(current_admin, Ok(admin.clone()));

    // Accept by new admin
    env.mock_auths(&[MockAuth {
        address: &new_admin,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_admin",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.accept_admin();
    assert_eq!(result, Ok(()));

    // Admin is now the new one
    let current_admin = client.get_admin();
    assert_eq!(current_admin, Ok(new_admin.clone()));

    // No pending admin
    let pending = client.get_pending_admin();
    assert_eq!(pending, None);
}

#[test]
fn admin_propose_cancel() {
    let (env, client, admin, _fee_recipient, _token) = setup();
    let new_admin = Address::generate(&env);

    client.propose_admin(&new_admin);

    let pending = client.get_pending_admin();
    assert_eq!(pending, Some(new_admin.clone()));

    // Cancel by current admin
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "cancel_admin_proposal",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.cancel_admin_proposal();
    assert_eq!(result, Ok(()));

    // No pending admin
    let pending = client.get_pending_admin();
    assert_eq!(pending, None);

    // Admin is still the old one
    let current_admin = client.get_admin();
    assert_eq!(current_admin, Ok(admin));
}

#[test]
fn admin_propose_repropose() {
    let (_env, client, _admin, _fee_recipient, _token) = setup();
    let new_admin1 = Address::generate(&_env);
    let new_admin2 = Address::generate(&_env);

    client.propose_admin(&new_admin1);
    let pending = client.get_pending_admin();
    assert_eq!(pending, Some(new_admin1.clone()));

    // Propose a different admin
    client.propose_admin(&new_admin2);
    let pending = client.get_pending_admin();
    assert_eq!(pending, Some(new_admin2));
}

#[test]
fn accept_admin_fails_with_wrong_address() {
    let (env, client, _admin, _fee_recipient, _token) = setup();
    let new_admin = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.propose_admin(&new_admin);

    // Try to accept with wrong address
    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_admin",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_accept_admin();
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn accept_admin_fails_without_proposal() {
    let (env, client, _admin, _fee_recipient, _token) = setup();
    let someone = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &someone,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_admin",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_accept_admin();
    assert_eq!(result, Err(Ok(Error::NoPendingAdmin)));
}

#[test]
fn old_admin_loses_access_after_accept() {
    let (env, client, old_admin, _fee_recipient, _token) = setup();
    let new_admin = Address::generate(&env);

    client.propose_admin(&new_admin);
    
    env.mock_auths(&[MockAuth {
        address: &new_admin,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_admin",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);
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
    assert_eq!(result, Err(Ok(Error::Unauthorized)));

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

    let result = client.pause();
    assert_eq!(result, Ok(()));
}

#[test]
fn propose_to_current_admin_is_noop() {
    let (_env, client, admin, _fee_recipient, _token) = setup();

    let result = client.propose_admin(&admin);
    assert_eq!(result, Ok(()));

    // No pending proposal
    let pending = client.get_pending_admin();
    assert_eq!(pending, None);
}

#[test]
fn set_admin_is_alias_for_propose() {
    let (_env, client, _admin, _fee_recipient, _token) = setup();
    let new_admin = Address::generate(&_env);

    client.set_admin(&new_admin);

    let pending = client.get_pending_admin();
    assert_eq!(pending, Some(new_admin));
}

// ══════════════════════════════════════════════════════════════════════════
//  Ownership Transfer Two-Step Tests
// ══════════════════════════════════════════════════════════════════════════

fn create_funded_commitment(
    env: &Env,
    client: &EscrowContractClient,
    owner: &Address,
    admin: &Address,
    token: &Address,
) -> u64 {
    let token_client = soroban_sdk::token::Client::new(env, token);
    token_client.mint(owner, &100_000i128);
    token_client.mint(admin, &10_000i128);

    client.deposit_yield_pool(&10_000i128);

    let commitment_id = client.create_commitment_default(
        owner,
        token,
        &1000i128,
        &RiskProfile::Safe,
        &30u32,
    );
    client.fund_escrow(&commitment_id);
    commitment_id
}

#[test]
fn ownership_offer_and_accept() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);

    // Offer transfer
    env.mock_auths(&[MockAuth {
        address: &owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "transfer_ownership",
            args: (commitment_id, new_owner.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.transfer_ownership(&commitment_id, &new_owner);
    assert_eq!(result, Ok(()));

    // Check pending
    let pending = client.get_pending_owner(&commitment_id);
    assert!(pending.is_some());
    assert_eq!(pending.unwrap().to, new_owner);

    // Commitment is still owned by original owner
    let commitment = client.get_commitment(&commitment_id).unwrap();
    assert_eq!(commitment.owner, owner);

    // Accept by new owner
    env.mock_auths(&[MockAuth {
        address: &new_owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_ownership",
            args: (commitment_id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.accept_ownership(&commitment_id);
    assert_eq!(result, Ok(()));

    // Commitment is now owned by new owner
    let commitment = client.get_commitment(&commitment_id).unwrap();
    assert_eq!(commitment.owner, new_owner);

    // No pending transfer
    let pending = client.get_pending_owner(&commitment_id);
    assert_eq!(pending, None);
}

#[test]
fn ownership_offer_and_cancel() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);

    client.transfer_ownership(&commitment_id, &new_owner);

    let pending = client.get_pending_owner(&commitment_id);
    assert!(pending.is_some());

    // Cancel by owner
    env.mock_auths(&[MockAuth {
        address: &owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "cancel_ownership_transfer",
            args: (commitment_id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.cancel_ownership_transfer(&commitment_id);
    assert_eq!(result, Ok(()));

    // No pending transfer
    let pending = client.get_pending_owner(&commitment_id);
    assert_eq!(pending, None);

    // Owner unchanged
    let commitment = client.get_commitment(&commitment_id).unwrap();
    assert_eq!(commitment.owner, owner);
}

#[test]
fn accept_ownership_fails_with_wrong_address() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);
    let attacker = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);
    client.transfer_ownership(&commitment_id, &new_owner);

    // Try to accept with wrong address
    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_ownership",
            args: (commitment_id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_accept_ownership(&commitment_id);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn accept_ownership_fails_without_offer() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);
    let someone = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);

    env.mock_auths(&[MockAuth {
        address: &someone,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_ownership",
            args: (commitment_id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_accept_ownership(&commitment_id);
    assert_eq!(result, Err(Ok(Error::NoPendingTransfer)));
}

#[test]
fn accept_ownership_fails_after_expiry() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);
    client.transfer_ownership(&commitment_id, &new_owner);

    // Advance time past expiry (7 days)
    env.ledger().with_mut(|li| {
        li.timestamp += 7 * 86_400 + 1;
    });

    env.mock_auths(&[MockAuth {
        address: &new_owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_ownership",
            args: (commitment_id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_accept_ownership(&commitment_id);
    assert_eq!(result, Err(Ok(Error::TransferExpired)));
}

#[test]
fn pending_offer_cleared_on_refund() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);
    client.transfer_ownership(&commitment_id, &new_owner);

    let pending = client.get_pending_owner(&commitment_id);
    assert!(pending.is_some());

    // Refund the commitment
    env.mock_auths(&[MockAuth {
        address: &owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "refund",
            args: (commitment_id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.refund(&commitment_id);

    // Pending offer is cleared
    let pending = client.get_pending_owner(&commitment_id);
    assert_eq!(pending, None);
}

#[test]
fn pending_offer_cleared_on_dispute() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);
    client.transfer_ownership(&commitment_id, &new_owner);

    let pending = client.get_pending_owner(&commitment_id);
    assert!(pending.is_some());

    // Dispute the commitment
    let reason = String::from_str(&env, "test dispute");
    env.mock_auths(&[MockAuth {
        address: &owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "dispute",
            args: (commitment_id, owner.clone(), reason.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.dispute(&commitment_id, &owner, &reason);

    // Pending offer is cleared
    let pending = client.get_pending_owner(&commitment_id);
    assert_eq!(pending, None);
}

#[test]
fn accept_fails_on_non_funded_commitment() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);
    client.transfer_ownership(&commitment_id, &new_owner);

    // Refund to change state
    env.mock_auths(&[MockAuth {
        address: &owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "refund",
            args: (commitment_id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.refund(&commitment_id);

    // Try to accept - should fail since no longer funded
    env.mock_auths(&[MockAuth {
        address: &new_owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_ownership",
            args: (commitment_id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_accept_ownership(&commitment_id);
    assert_eq!(result, Err(Ok(Error::NoPendingTransfer)));
}

#[test]
fn owner_index_correct_at_each_step() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);

    // Initially owned by owner
    let owner_ids = client.get_user_commitment_ids(&owner);
    assert_eq!(owner_ids.len(), 1);
    assert_eq!(owner_ids.get(0).unwrap(), commitment_id);

    let new_owner_ids = client.get_user_commitment_ids(&new_owner);
    assert_eq!(new_owner_ids.len(), 0);

    // Offer transfer
    client.transfer_ownership(&commitment_id, &new_owner);

    // Still in old owner's index
    let owner_ids = client.get_user_commitment_ids(&owner);
    assert_eq!(owner_ids.len(), 1);

    let new_owner_ids = client.get_user_commitment_ids(&new_owner);
    assert_eq!(new_owner_ids.len(), 0);

    // Accept
    env.mock_auths(&[MockAuth {
        address: &new_owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_ownership",
            args: (commitment_id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.accept_ownership(&commitment_id);

    // Now in new owner's index, not in old owner's
    let owner_ids = client.get_user_commitment_ids(&owner);
    assert_eq!(owner_ids.len(), 0);

    let new_owner_ids = client.get_user_commitment_ids(&new_owner);
    assert_eq!(new_owner_ids.len(), 1);
    assert_eq!(new_owner_ids.get(0).unwrap(), commitment_id);
}

#[test]
fn transfer_to_same_owner_is_noop() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);

    env.mock_auths(&[MockAuth {
        address: &owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "transfer_ownership",
            args: (commitment_id, owner.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.transfer_ownership(&commitment_id, &owner);
    assert_eq!(result, Ok(()));

    // No pending transfer
    let pending = client.get_pending_owner(&commitment_id);
    assert_eq!(pending, None);
}

#[test]
fn transfer_to_contract_address_rejected() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);

    env.mock_auths(&[MockAuth {
        address: &owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "transfer_ownership",
            args: (commitment_id, client.address.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_transfer_ownership(&commitment_id, &client.address);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn token_balances_unchanged_during_transfer_flow() {
    let (env, client, admin, _fee_recipient, token) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let token_client = soroban_sdk::token::Client::new(&env, &token);

    let commitment_id = create_funded_commitment(&env, &client, &owner, &admin, &token);

    let owner_balance_before = token_client.balance(&owner);
    let new_owner_balance_before = token_client.balance(&new_owner);
    let contract_balance_before = token_client.balance(&client.address);

    // Offer
    client.transfer_ownership(&commitment_id, &new_owner);

    let owner_balance_after_offer = token_client.balance(&owner);
    let new_owner_balance_after_offer = token_client.balance(&new_owner);
    let contract_balance_after_offer = token_client.balance(&client.address);

    assert_eq!(owner_balance_before, owner_balance_after_offer);
    assert_eq!(new_owner_balance_before, new_owner_balance_after_offer);
    assert_eq!(contract_balance_before, contract_balance_after_offer);

    // Accept
    env.mock_auths(&[MockAuth {
        address: &new_owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "accept_ownership",
            args: (commitment_id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.accept_ownership(&commitment_id);

    let owner_balance_after_accept = token_client.balance(&owner);
    let new_owner_balance_after_accept = token_client.balance(&new_owner);
    let contract_balance_after_accept = token_client.balance(&client.address);

    assert_eq!(owner_balance_before, owner_balance_after_accept);
    assert_eq!(new_owner_balance_before, new_owner_balance_after_accept);
    assert_eq!(contract_balance_before, contract_balance_after_accept);
}
