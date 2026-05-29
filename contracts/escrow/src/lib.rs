// Triggering rebuild
#![no_std]
#![allow(non_snake_case)]
//! CommitLabs Escrow Contract

//!
//! Implements the on-chain escrow lifecycle backing CommitLabs liquidity
//! commitments. A commitment locks a depositor's assets for a fixed duration
//! under a chosen risk profile (Safe / Balanced / Aggressive). Funds are held
//! in escrow until the commitment matures (release), is exited early (refund
//! minus penalty), or is disputed (frozen pending resolution).
//!
//! Lifecycle:
//!   create_commitment -> fund_escrow -> {release | refund | dispute -> resolve_dispute}
//!
//! This contract mirrors the methods the backend service layer
//! (`src/lib/backend/services/contracts.ts`) expects to call: `create_commitment`,
//! `fund_escrow`, `release`, `refund`, and `dispute`.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, String, Symbol, Vec,
};

// Configuration constants for escrow contract
// Configuration constants for escrow contract
// Number of seconds in a day used for maturity calculation.
const SECONDS_PER_DAY: u64 = 86_400;

/// Upper bound for commitment amount enforced by `create_commitment`.
/// Aligns with backend `CommitmentLimits.max_amount`.
const MAX_AMOUNT: i128 = 1_000_000_000_000;

/// Upper bound for commitment duration (in days) enforced by `create_commitment`.
/// Aligns with backend `CommitmentLimits.max_duration_days`.
const MAX_DURATION_DAYS: u32 = 365;

/// Upper bound for penalty basis points (10_000 = 100%).
const MAX_PENALTY_BPS: u32 = 10_000;

/// Storage keys for persistent contract state.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Contract administrator (can resolve disputes, set token).
    Admin,
    /// The token (SAC) address used for all escrow transfers.
    Token,
    /// Monotonic counter used to mint new commitment ids.
    NextId,
    /// A single commitment record keyed by its id.
    Commitment(u64),
    /// List of commitment ids owned by an address.
    OwnerIndex(Address),
    /// Protocol fee recipient.
    FeeRecipient,
    /// Dispute record for a commitment, keyed by commitment id.
    Dispute(u64),
    /// Default penalty in basis points for each RiskProfile.
    DefaultPenalty(RiskProfile),
    /// Contract pause flag used for emergency write halts.
    Paused,
    /// On-chain yield pool balance used to pay matured commitment yield.
    YieldPool,
    /// Historical attestation records keyed by commitment id.
    Attestations(u64),
    /// Configurable penalty-free grace period before maturity, in seconds.
    GracePeriodSeconds,
}

/// Risk profile chosen at creation time. Determines the early-exit penalty
/// applied during `refund`.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RiskProfile {
    Safe,
    Balanced,
    Aggressive,
}

/// Lifecycle status of a commitment escrow.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    /// Created but not yet funded.
    Created,
    /// Funded and actively held in escrow.
    Funded,
    /// Matured and released to the owner.
    Released,
    /// Exited early; refunded minus penalty.
    Refunded,
    /// Under dispute; transfers are frozen.
    Disputed,
    /// Compliance score dropped below the violation threshold; transfers frozen until resolved.
    Violated,
}

/// Categorized dispute reason enum. Enables efficient on-chain classification
/// and off-chain indexing of disputes by category.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DisputeReason {
    /// Actual value delivered did not match the promised or agreed value.
    ValueMismatch = 0,
    /// Reported compliance violation or attestation failure.
    NonCompliance = 1,
    /// Suspected fraudulent activity or unauthorized access.
    FraudSuspicion = 2,
    /// Operational failure or delivery failure.
    OperationalFailure = 3,
    /// Other reasons not covered by the above categories.
    Other = 4,
}

/// Dispute record: stores both the categorized reason and the free-form
/// reason string for audit and detailed context.
#[contracttype]
#[derive(Clone)]
pub struct DisputeRecord {
    /// Categorized reason for the dispute.
    pub reason_category: DisputeReason,
    /// Free-form reason string for detailed explanation and audit.
    pub reason_text: String,
    /// Timestamp when the dispute was opened.
    pub disputed_at: u64,
    /// Address that initiated the dispute (owner or admin).
    pub disputed_by: Address,
}

/// Historical compliance attestation stored against a commitment.
#[contracttype]
#[derive(Clone)]
pub struct AttestationRecord {
    pub attestor: Address,
    pub compliance_score: u32,
    pub timestamp: u64,
}

/// A single escrow / commitment record.
#[contracttype]
#[derive(Clone)]
pub struct Commitment {
    pub id: u64,
    pub owner: Address,
    pub asset: Address,
    pub amount: i128,
    pub accrued_yield: i128,
    pub risk: RiskProfile,
    pub status: EscrowStatus,
    /// Ledger timestamp (seconds) at which the commitment may be released.
    pub maturity: u64,
    /// Early-exit penalty in basis points (e.g. 200 = 2%).
    pub penalty_bps: u32,
    /// Compliance score 0..=100 recorded by the attestation engine.
    pub compliance_score: u32,
    pub created_at: u64,
    /// Arbitrary key-value metadata supplied at creation time (e.g. risk notes,
    /// off-chain context). Keys and values are both `String`. Empty by default.
    pub metadata: Map<String, String>,
}

/// Errors returned to the caller. Numeric codes are stable and surfaced by the
/// backend `normalizeContractError` mapper.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotFound = 3,
    Unauthorized = 4,
    InvalidAmount = 5,
    InvalidState = 6,
    NotMatured = 7,
    InvalidDuration = 8,
    PenaltyTooHigh = 9,
    /// Contract is currently paused for emergency halt.
    Paused = 10,
    /// Token asset does not match the configured escrow token.
    AssetMismatch = 11,
    /// Yield pool has insufficient balance to pay matured commitment yield.
    InsufficientYieldPool = 12,
    /// WASM hash provided for upgrade is invalid (e.g. zero hash).
    InvalidWasmHash = 13,
    /// Commitment is in Violated status; release and refund are blocked until resolved.
    CommitmentViolated = 14,
}

/// Result of an early exit commitment.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[allow(non_snake_case)]
pub struct EarlyExitResult {
    pub exitAmount: i128,
    pub penaltyAmount: i128,
    pub finalStatus: EscrowStatus,
}



#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// One-time initialization. Sets the admin, the escrow token, fee recipient,
    /// and default penalty rates for each risk profile. Default penalties should
    /// match the risk tier (e.g., Safe 200 bps [2%], Balanced 300 bps [3%],
    /// Aggressive 500 bps [5%]).
    ///
    /// # Arguments
    /// * `admin` - Administrator address (can resolve disputes)
    /// * `token` - Escrow token (SAC) address
    /// * `fee_recipient` - Address that receives early-exit penalties
    /// * `safe_default_penalty_bps` - Default penalty for Safe risk profile (in basis points)
    /// * `balanced_default_penalty_bps` - Default penalty for Balanced risk profile
    /// * `aggressive_default_penalty_bps` - Default penalty for Aggressive risk profile
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        fee_recipient: Address,
        safe_default_penalty_bps: u32,
        balanced_default_penalty_bps: u32,
        aggressive_default_penalty_bps: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();

        // Validate penalty values.
        if safe_default_penalty_bps > MAX_PENALTY_BPS
            || balanced_default_penalty_bps > MAX_PENALTY_BPS
            || aggressive_default_penalty_bps > MAX_PENALTY_BPS
        {
            return Err(Error::PenaltyTooHigh);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage()
            .instance()
            .set(&DataKey::FeeRecipient, &fee_recipient);
        env.storage().instance().set(&DataKey::NextId, &0u64);

        // Store default penalties for each risk profile.
        env.storage()
            .instance()
            .set(&DataKey::DefaultPenalty(RiskProfile::Safe), &safe_default_penalty_bps);
        env.storage()
            .instance()
            .set(&DataKey::DefaultPenalty(RiskProfile::Balanced), &balanced_default_penalty_bps);
        env.storage()
            .instance()
            .set(&DataKey::DefaultPenalty(RiskProfile::Aggressive), &aggressive_default_penalty_bps);
        env.storage()
            .instance()
            .set(&DataKey::GracePeriodSeconds, &0u64);

        Ok(())
    }

    /// Pause contract writes. Admin only.
    pub fn pause(env: Env) -> Result<(), Error> {
        Self::require_init(&env)?;
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events()
            .publish((Symbol::new(&env, "pause"), admin), ());
        Ok(())
    }

    /// Resume contract writes after an emergency pause. Admin only.
    pub fn unpause(env: Env) -> Result<(), Error> {
        Self::require_init(&env)?;
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events()
            .publish((Symbol::new(&env, "unpause"), admin), ());
        Ok(())
    }

    /// Return whether the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    /// Create a new (unfunded) commitment escrow. Returns the new commitment id.
    ///
    /// Validates input against upper bounds defined by backend `CommitmentLimits`:
    /// * `amount` must be > 0 and <= `MAX_AMOUNT`.
    /// * `duration_days` must be > 0 and <= `MAX_DURATION_DAYS`.
    /// * `penalty_bps` must be <= `MAX_PENALTY_BPS`.
    ///
    /// `duration_days` is converted to an absolute maturity timestamp using the
    /// current ledger time with checked arithmetic to avoid overflow. `penalty_bps`
    /// is the early-exit penalty applied on `refund`.
    pub fn create_commitment(
        env: Env,
        owner: Address,
        asset: Address,
        amount: i128,
        risk: RiskProfile,
        duration_days: u32,
        penalty_bps: u32,
        metadata: Map<String, String>,
    ) -> Result<u64, Error> {
        Self::require_init(&env)?;
        Self::require_not_paused(&env)?;
        owner.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if amount > MAX_AMOUNT {
            return Err(Error::InvalidAmount);
        }
        if duration_days == 0 {
            return Err(Error::InvalidDuration);
        }
        if duration_days > MAX_DURATION_DAYS {
            return Err(Error::InvalidDuration);
        }
        if penalty_bps > MAX_PENALTY_BPS {
            return Err(Error::PenaltyTooHigh);
        }

        let id = Self::next_id(&env);
        let now = env.ledger().timestamp();
        let maturity = now.checked_add((duration_days as u64).checked_mul(SECONDS_PER_DAY).ok_or(Error::InvalidDuration)?).ok_or(Error::InvalidDuration)?;

        let commitment = Commitment {
            id,
            owner: owner.clone(),
            asset,
            amount,
            accrued_yield: 0,
            risk,
            status: EscrowStatus::Created,
            maturity,
            penalty_bps,
            compliance_score: 100,
            created_at: now,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Commitment(id), &commitment);
        Self::index_owner(&env, &owner, id);

        env.events().publish(
            (Symbol::new(&env, "create_commitment"), owner),
            (id, amount, maturity),
        );
        Ok(id)
    }

    /// Create a new (unfunded) commitment escrow using the default penalty for
    /// the specified risk profile. Returns the new commitment id.
    ///
    /// This function inherits the penalty_bps from the risk profile defaults
    /// configured at initialization time. If an explicit penalty override is
    /// needed, use `create_commitment()` instead.
    ///
    /// `duration_days` is converted to an absolute maturity timestamp using the
    /// current ledger time.
    pub fn create_commitment_with_default_penalty(
        env: Env,
        owner: Address,
        asset: Address,
        amount: i128,
        risk: RiskProfile,
        duration_days: u32,
    ) -> Result<u64, Error> {
        Self::require_init(&env)?;
        owner.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if duration_days == 0 {
            return Err(Error::InvalidDuration);
        }

        // Retrieve the default penalty for this risk profile.
        let penalty_bps = Self::get_default_penalty_internal(&env, risk)?;

        let id = Self::next_id(&env);
        let now = env.ledger().timestamp();
        let maturity = now + (duration_days as u64) * SECONDS_PER_DAY;

        let accrued_yield = calculate_accrued_yield(amount, duration_days, risk);
        let commitment = Commitment {
            id,
            owner: owner.clone(),
            asset,
            amount,
            accrued_yield,
            risk,
            status: EscrowStatus::Created,
            maturity,
            penalty_bps,
            compliance_score: 100,
            created_at: now,
            metadata,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Commitment(id), &commitment);
        Self::index_owner(&env, &owner, id);

        env.events().publish(
            (Symbol::new(&env, "create_commitment"), owner),
            (id, amount, maturity),
        );
        Ok(id)
    }

    /// Move tokens from the owner into the contract, transitioning the
    /// commitment from `Created` to `Funded`.
    pub fn fund_escrow(env: Env, commitment_id: u64) -> Result<(), Error> {
        Self::require_init(&env)?;
        Self::require_not_paused(&env)?;
        let mut c = Self::load(&env, commitment_id)?;
        c.owner.require_auth();

        if c.status != EscrowStatus::Created {
            return Err(Error::InvalidState);
        }

        // Validate that the commitment's asset matches the configured escrow token.
        let configured_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;
        if c.asset != configured_token {
            return Err(Error::AssetMismatch);
        }

        let token = Self::token_client(&env);

        // Precheck owner's balance and allowance to avoid opaque panics from
        // the token contract and surface a clear contract error instead.
        let owner_balance = token.balance(&c.owner);
        if owner_balance < c.amount {
            return Err(Error::InsufficientBalance);
        }
        token.transfer(&c.owner, &env.current_contract_address(), &c.amount);

        c.status = EscrowStatus::Funded;
        Self::save(&env, &c);

        env.events().publish(
            (Symbol::new(&env, "fund_escrow"), c.owner.clone()),
            (commitment_id, c.amount),
        );
        Ok(())
    }

    /// Deposit yield tokens into the contract's dedicated yield pool.
    /// Only the admin may fund the pool used to pay matured commitment yield.
    pub fn deposit_yield_pool(env: Env, admin: Address, amount: i128) -> Result<(), Error> {
        Self::require_init(&env)?;
        admin.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token = Self::token_client(&env);
        let contract = env.current_contract_address();
        token.transfer(&admin, &contract, &amount);

        let balance = Self::yield_pool_balance(&env);
        Self::set_yield_pool_balance(&env, balance + amount);

        env.events().publish(
            (Symbol::new(&env, "deposit_yield_pool"), admin),
            (amount, balance + amount),
        );
        Ok(())
    }

    /// Read the current yield pool balance available to pay matured commitment yield.
    pub fn get_yield_pool_balance(env: Env) -> i128 {
        Self::yield_pool_balance(&env)
    }

    /// Release the escrowed funds back to the owner once the commitment has
    /// matured.
    ///
    /// Authorization rationale:
    /// - Post-maturity this call is permissionless: any actor (including a
    ///   third party) may invoke `release` to move funds out of the contract.
    /// - This design avoids liveness issues where the owner cannot trigger
    ///   release (e.g. lost key) while still protecting funds against
    ///   diversion. To prevent an invoker from capturing funds, the transfer
    ///   ALWAYS targets the stored `owner` recorded on the `Commitment`.
    ///   The invoker never receives the escrowed asset.
    pub fn release(env: Env, commitment_id: u64) -> Result<i128, Error> {
        Self::require_init(&env)?;
        let mut c = Self::load(&env, commitment_id)?;

        if c.status == EscrowStatus::Violated {
            return Err(Error::CommitmentViolated);
        }
        if c.status != EscrowStatus::Funded {
            return Err(Error::InvalidState);
        }
        // Enforce maturity: release is only allowed once the duration has
        // elapsed. If the ledger timestamp is still before maturity we return
        // the explicit `NotMatured` error so callers can handle that case.
        if env.ledger().timestamp() < c.maturity {
            return Err(Error::NotMatured);
        }

        let yield_pool = Self::yield_pool_balance(&env);
        if yield_pool < c.accrued_yield {
            return Err(Error::InsufficientYieldPool);
        }

        let total_payout = c.amount + c.accrued_yield;
        let token = Self::token_client(&env);
        let contract = env.current_contract_address();
        token.transfer(&contract, &c.owner, &total_payout);

        Self::set_yield_pool_balance(&env, yield_pool - c.accrued_yield);
        c.status = EscrowStatus::Released;
        Self::save(&env, &c);

        // Interactions: External token transfers
        let token = Self::token_client(&env);
        token.transfer(&env.current_contract_address(), &c.owner, &c.amount);

        env.events().publish(
            (Symbol::new(&env, "release"), c.owner.clone()),
            (commitment_id, total_payout, c.accrued_yield),
        );
        Ok(total_payout)
    }

    /// Early-exit refund. Returns the principal minus the early-exit penalty;
    /// the penalty is sent to the fee recipient. Only the owner may refund and
    /// only while the commitment is `Funded` and before maturity.
    pub fn refund(env: Env, commitment_id: u64) -> Result<i128, Error> {
        Self::require_init(&env)?;
        let c = Self::load(&env, commitment_id)?;
        c.owner.require_auth();
        let (refund_amount, _) = Self::execute_refund(&env, c)?;
        Ok(refund_amount)
    }

    /// Partial early-exit refund. Withdraws `amount` from the escrowed principal,
    /// applying the proportional `penalty_bps` to the withdrawn portion only. The
    /// remaining principal stays escrowed and the commitment status stays `Funded`.
    /// If `amount` equals the full principal the commitment transitions to `Refunded`.
    ///
    /// Only the owner may call this and only while the commitment is `Funded`. The
    /// call is rejected if the commitment is in `Violated` status.
    ///
    /// # Arguments
    /// * `commitment_id` - The id of the target commitment.
    /// * `amount` - The portion of the principal to withdraw (must be > 0 and ≤ stored amount).
    pub fn refund_partial(
        env: Env,
        commitment_id: u64,
        amount: i128,
    ) -> Result<i128, Error> {
        Self::require_init(&env)?;
        Self::require_not_paused(&env)?;
        let mut c = Self::load(&env, commitment_id)?;
        c.owner.require_auth();

        if c.status == EscrowStatus::Violated {
            return Err(Error::CommitmentViolated);
        }
        if c.status != EscrowStatus::Funded {
            return Err(Error::InvalidState);
        }
        if amount <= 0 || amount > c.amount {
            return Err(Error::InvalidAmount);
        }

        // Basis points represent a fraction out of 10_000. The penalty is the
        // floor of `amount * penalty_bps / 10_000`, so refund + penalty always
        // partitions the original principal while staying within checked math.
        let (penalty, refund_amount) = Self::compute_refund_amount(c.amount, c.penalty_bps)?;

        // Update the stored principal; remainder stays in escrow.
        let remaining = c
            .amount
            .checked_sub(amount)
            .ok_or(Error::InvalidAmount)?;
        c.amount = remaining;
        if remaining == 0 {
            c.status = EscrowStatus::Refunded;
        }

        // Effects: persist before token interactions.
        Self::save(&env, &c);

        // Interactions: transfer penalty then refund.
        let token = Self::token_client(&env);
        let contract = env.current_contract_address();
        if penalty > 0 {
            let fee_recipient: Address = env
                .storage()
                .instance()
                .get(&DataKey::FeeRecipient)
                .ok_or(Error::NotInitialized)?;
            token.transfer(&contract, &fee_recipient, &penalty);
        }
        token.transfer(&contract, &c.owner, &refund_amount);

        env.events().publish(
            (Symbol::new(&env, "refund_partial"), c.owner.clone()),
            (commitment_id, refund_amount, penalty, remaining),
        );
        Ok(refund_amount)
    }

    /// Process an early exit for a commitment. Only the owner (caller) may early exit
    /// and only while the commitment is `Funded`. Returns the structured result including
    /// exit amount, penalty amount, and updated status.
    pub fn early_exit_commitment(
        env: Env,
        commitment_id: u64,
        caller: Address,
    ) -> Result<EarlyExitResult, Error> {
        Self::require_init(&env)?;
        caller.require_auth();
        let c = Self::load(&env, commitment_id)?;
        if caller != c.owner {
            return Err(Error::Unauthorized);
        }
        let (exit_amount, penalty_amount) = Self::execute_refund(&env, c)?;
        Ok(EarlyExitResult {
            exitAmount: exit_amount,
            penaltyAmount: penalty_amount,
            finalStatus: EscrowStatus::Refunded,
        })
    }

    /// Flag a funded commitment as disputed, freezing release/refund until an
    /// admin resolves it. Either the owner or the admin may open a dispute.
    /// The reason string is automatically categorized based on keywords.
    pub fn dispute(env: Env, commitment_id: u64, caller: Address, reason: String) -> Result<(), Error> {
        Self::require_init(&env)?;
        caller.require_auth();
        let mut c = Self::load(&env, commitment_id)?;

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        if caller != c.owner && caller != admin {
            return Err(Error::Unauthorized);
        }
        if c.status != EscrowStatus::Funded {
            return Err(Error::InvalidState);
        }

        // Categorize the dispute reason based on keywords in the reason string.
        let reason_category = Self::categorize_dispute_reason(&reason);
        let now = env.ledger().timestamp();

        let dispute_record = DisputeRecord {
            reason_category,
            reason_text: reason.clone(),
            disputed_at: now,
            disputed_by: caller.clone(),
        };

        c.status = EscrowStatus::Disputed;
        Self::save(&env, &c);

        // Persist the dispute record.
        env.storage()
            .persistent()
            .set(&DataKey::Dispute(commitment_id), &dispute_record);

        env.events().publish(
            (Symbol::new(&env, "dispute"), caller),
            (commitment_id, reason_category as u32, reason),
        );
        Ok(())
    }

    /// Admin-only resolution of a dispute. `release_to_owner = true` pays the
    /// owner the full principal; `false` refunds principal minus penalty.
    pub fn resolve_dispute(
        env: Env,
        commitment_id: u64,
        release_to_owner: bool,
    ) -> Result<i128, Error> {
        Self::require_init(&env)?;
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        let mut c = Self::load(&env, commitment_id)?;
        if c.status != EscrowStatus::Disputed {
            return Err(Error::InvalidState);
        }

        let paid;
        let penalty;

        if release_to_owner {
            let mut payout = c.amount;
            if env.ledger().timestamp() >= c.maturity {
                let yield_pool = Self::yield_pool_balance(&env);
                if yield_pool < c.accrued_yield {
                    return Err(Error::InsufficientYieldPool);
                }
                payout += c.accrued_yield;
                Self::set_yield_pool_balance(&env, yield_pool - c.accrued_yield);
            }
            token.transfer(&contract, &c.owner, &payout);
            c.status = EscrowStatus::Released;
            paid = payout;
        } else {
            c.status = EscrowStatus::Refunded;
            penalty = (c.amount * c.penalty_bps as i128) / MAX_PENALTY_BPS as i128;
            paid = c.amount - penalty;
        }

        // Effects: Update state before interactions to prevent reentrancy
        Self::save(&env, &c);

        // Interactions: External token transfers
        let token = Self::token_client(&env);
        let contract = env.current_contract_address();
        let paid;
        if release_to_owner {
            token.transfer(&contract, &c.owner, &c.amount);
            c.status = EscrowStatus::Released;
            paid = c.amount;
        } else {
            let (_, refund_amount) = Self::compute_refund_amount(c.amount, c.penalty_bps)?;
            paid = refund_amount;
            token.transfer(&contract, &c.owner, &paid);
            c.status = EscrowStatus::Refunded;
        }
        token.transfer(&contract, &c.owner, &paid);

        env.events().publish(
            (Symbol::new(&env, "resolve_dispute"), admin),
            (commitment_id, release_to_owner, paid),
        );
        Ok(paid)
    }

    /// Upgrade the escrow contract to a new WASM implementation.
    ///
    /// Only the configured admin may perform contract upgrades. This uses the
    /// stored `DataKey::Admin` authorization principal and then updates the
    /// current contract WASM through the deployer. The new wasm hash must be a
    /// valid 32-byte contract hash and cannot be the zero hash.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        // Ensure the contract has been initialized and admin is present.
        Self::require_init(&env)?;

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;

        // Admin must sign the upgrade transaction.
        // Authorization model:
        // - The admin address is stored in contract instance storage under
        //   `DataKey::Admin` and is the single authority allowed to perform
        //   upgrades.
        // - We read the admin from storage at runtime (not hardcoded), then
        //   require the admin to sign the transaction with `require_auth()`.
        // - `require_auth()` enforces that the calling transaction is
        //   authorized by the admin signature. If the admin key does not
        //   authorize the transaction, execution stops here and no upgrade
        //   will be performed.
        // - This keeps the upgrade surface minimal: only a signed admin
        //   invocation can reach `update_current_contract_wasm`.
        admin.require_auth();

        // Prevent a zero-hash upgrade which is not a valid deployed contract.
        // Rejecting the zero hash avoids accidentally setting the contract's
        // implementation to an invalid/empty WASM.
        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);
        if new_wasm_hash == zero_hash {
            return Err(Error::InvalidWasmHash);
        }

        // Perform the upgrade via the deployer. This is the critical action
        // that swaps the current contract implementation to the provided
        // `new_wasm_hash`. Because we've already enforced `admin.require_auth()`
        // above, this call is safe under the contract's upgrade authorization
        // model: only an admin-signed transaction can reach this point.
        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());

        // Emit an event that an upgrade occurred. Observers can verify the
        // new wasm hash and audit who performed the upgrade.
        env.events().publish((Symbol::new(&env, "upgrade"), admin), new_wasm_hash);

        Ok(())
    }

    /// Set the minimum compliance score threshold. Any `record_attestation` call
    /// that records a score strictly below this value will automatically transition
    /// the commitment from `Funded` to `Violated`, freezing release and refund until
    /// the admin resolves it via `resolve_dispute`.
    ///
    /// Admin only. A threshold of 0 disables auto-violation.
    ///
    /// # Arguments
    /// * `threshold` - Score threshold 0..=100 (0 = disabled, 60 = violate below 60).
    pub fn set_violation_threshold(env: Env, threshold: u32) -> Result<(), Error> {
        Self::require_init(&env)?;
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        let clamped = threshold.min(100);
        env.storage()
            .instance()
            .set(&DataKey::ViolationThreshold, &clamped);
        env.events()
            .publish((Symbol::new(&env, "set_violation_threshold"), admin), clamped);
        Ok(())
    }

    /// Return the current violation threshold (0..=100). A compliance score
    /// strictly below this value triggers auto-violation on attestation.
    /// Returns 0 if no threshold has been configured (auto-violation disabled).
    pub fn get_violation_threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ViolationThreshold)
            .unwrap_or(0)
    }

    /// Record a compliance attestation (0..=100) against a commitment. Mirrors
    /// the attestation engine integration used by the backend.
    pub fn record_attestation(
        env: Env,
        commitment_id: u64,
        attestor: Address,
        compliance_score: u32,
    ) -> Result<(), Error> {
        Self::require_init(&env)?;
        attestor.require_auth();
        let mut c = Self::load(&env, commitment_id)?;
        let score = compliance_score.min(100);
        c.compliance_score = score;

        // Auto-violate a funded commitment when the score drops below the threshold.
        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ViolationThreshold)
            .unwrap_or(0);
        if threshold > 0 && score < threshold && c.status == EscrowStatus::Funded {
            c.status = EscrowStatus::Violated;
            env.events().publish(
                (Symbol::new(&env, "commitment_violated"), attestor.clone()),
                (commitment_id, score, threshold),
            );
        }

        Self::save(&env, &c);

        let mut attestations: Vec<AttestationRecord> = env
            .storage()
            .persistent()
            .get(&DataKey::Attestations(commitment_id))
            .unwrap_or_else(|| Vec::new(&env));
        
        attestations.push_back(AttestationRecord {
            attestor: attestor.clone(),
            compliance_score: score,
            timestamp: env.ledger().timestamp(),
        });
        
        env.storage()
            .persistent()
            .set(&DataKey::Attestations(commitment_id), &attestations);

        env.events().publish(
            (Symbol::new(&env, "record_attestation"), attestor),
            (commitment_id, score),
        );
        Ok(())
    }

    /// Read a single commitment record.
    pub fn get_commitment(env: Env, commitment_id: u64) -> Result<Commitment, Error> {
        Self::load(&env, commitment_id)
    }

    /// Transfer marketplace ownership for secondary trading.
    ///
    /// Preconditions:
    /// - Commitment must be in `Funded` state.
    ///
    /// Authorization:
    /// - Current commitment owner must authorize via `require_auth()`.
    ///
    /// Effects:
    /// - Updates `Commitment.owner`.
    /// - Maintains `OwnerIndex` for both the old owner and the new owner.
    /// - Emits `transfer_ownership`.
    pub fn transfer_ownership(env: Env, commitment_id: u64, new_owner: Address) -> Result<(), Error> {
        Self::require_init(&env)?;

        let mut c = Self::load(&env, commitment_id)?;

        // Authorization: only the current owner can transfer ownership.
        // NOTE: Must remain tied to the stored commitment owner.
        c.owner.require_auth();

        // Only allow transfer of funded commitments.
        if c.status != EscrowStatus::Funded {
            return Err(Error::InvalidState);
        }

        let old_owner = c.owner.clone();
        if old_owner == new_owner {
            // No-op transfer. Kept explicit to avoid index churn.
            return Ok(());
        }

        // Maintain OwnerIndex for both sides.
        Self::deindex_owner(&env, &old_owner, commitment_id);
        Self::index_owner(&env, &new_owner, commitment_id);

        c.owner = new_owner.clone();
        Self::save(&env, &c);

        env.events().publish(
            (Symbol::new(&env, "transfer_ownership"), old_owner),
            (commitment_id, new_owner),
        );

        Ok(())
    /// Return the list of attestation history for a commitment id.
    pub fn get_attestations(env: Env, commitment_id: u64) -> Vec<AttestationRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Attestations(commitment_id))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Return the list of commitment ids owned by an address.
    pub fn get_owner_commitments(env: Env, owner: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::OwnerIndex(owner))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Retrieve the dispute record for a commitment. Returns `None` if no
    /// dispute has been recorded.
    pub fn get_dispute(env: Env, commitment_id: u64) -> Option<DisputeRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Dispute(commitment_id))
    }

    /// Retrieve the default penalty (in basis points) for a specific risk profile.
    /// Configured at initialization time and used by
    /// `create_commitment_with_default_penalty()`. Useful for querying the
    /// current penalty configuration.
    pub fn get_default_penalty(env: Env, risk: RiskProfile) -> Result<u32, Error> {
        env.storage()
            .instance()
            .get(&DataKey::DefaultPenalty(risk))
            .ok_or(Error::NotInitialized)
    }

    /// Admin-only setter for the penalty-free grace period before maturity.
    /// If the commitment is refunded within the configured window before
    /// maturity, the early-exit penalty is waived.
    pub fn set_grace_period(env: Env, admin: Address, grace_period_seconds: u64) -> Result<(), Error> {
        Self::require_init(&env)?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::GracePeriodSeconds, &grace_period_seconds);
        env.events()
            .publish((Symbol::new(&env, "set_grace_period"), admin), (grace_period_seconds,));
        Ok(())
    }

    /// Returns the currently configured penalty-free grace period in seconds.
    pub fn get_grace_period(env: Env) -> Result<u64, Error> {
        Self::require_init(&env)?;
        Ok(Self::grace_period_seconds(&env))
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    fn execute_refund(
        env: &Env,
        mut c: Commitment,
    ) -> Result<(i128, i128), Error> {
        if c.status == EscrowStatus::Violated {
            return Err(Error::CommitmentViolated);
        }
        if c.status != EscrowStatus::Funded {
            return Err(Error::InvalidState);
        }

        let penalty = if Self::is_within_grace_period(env, &c) {
            0
        } else {
            let penalty_mul = c
                .amount
                .checked_mul(c.penalty_bps as i128)
                .ok_or(Error::InvalidAmount)?;
            penalty_mul / MAX_PENALTY_BPS as i128
        };
        let refund_amount = c
            .amount
            .checked_sub(penalty)
            .ok_or(Error::InvalidAmount)?;

        let token = Self::token_client(env);
        let contract = env.current_contract_address();
        if penalty > 0 {
            let fee_recipient: Address = env
                .storage()
                .instance()
                .get(&DataKey::FeeRecipient)
                .ok_or(Error::NotInitialized)?;
            token.transfer(&contract, &fee_recipient, &penalty);
        }
        token.transfer(&contract, &c.owner, &refund_amount);

        c.status = EscrowStatus::Refunded;
        Self::save(env, &c);

        env.events().publish(
            (Symbol::new(env, "refund"), c.owner.clone()),
            (c.id, refund_amount, penalty),
        );
        Ok((refund_amount, penalty))
    }

    fn require_init(env: &Env) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }
        Ok(())
    }

    /// Compute the refund split using basis points.
    ///
    /// `penalty_bps` is a fraction out of 10_000, so `500` means 5%. We use
    /// integer floor division and checked arithmetic to preserve the invariant
    /// `refund + penalty == amount` without overflow.
    fn compute_refund_amount(amount: i128, penalty_bps: u32) -> Result<(i128, i128), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if penalty_bps > MAX_PENALTY_BPS {
            return Err(Error::PenaltyTooHigh);
        }

        let penalty = amount
            .checked_mul(penalty_bps as i128)
            .ok_or(Error::InvalidAmount)?
            / MAX_PENALTY_BPS as i128;
        let refund_amount = amount.checked_sub(penalty).ok_or(Error::InvalidAmount)?;

        Ok((penalty, refund_amount))
    }

    fn grace_period_seconds(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::GracePeriodSeconds)
            .unwrap_or(0)
    }

    fn is_within_grace_period(env: &Env, c: &Commitment) -> bool {
        let now = env.ledger().timestamp();
        let grace = Self::grace_period_seconds(env);
        if grace == 0 || now >= c.maturity {
            return false;
        }
        let threshold = c.maturity.saturating_sub(grace);
        now >= threshold
    }

    fn next_id(env: &Env) -> u64 {
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        id
    }

    fn require_not_paused(env: &Env) -> Result<(), Error> {
        if env.storage().instance().get(&DataKey::Paused).unwrap_or(false) {
            return Err(Error::Paused);
        }
        Ok(())
    }

    fn load(env: &Env, id: u64) -> Result<Commitment, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Commitment(id))
            .ok_or(Error::NotFound)
    }

    fn save(env: &Env, c: &Commitment) {
        env.storage()
            .persistent()
            .set(&DataKey::Commitment(c.id), c);
    }

    fn index_owner(env: &Env, owner: &Address, id: u64) {
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerIndex(owner.clone()))
            .unwrap_or_else(|| Vec::new(env));
        ids.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::OwnerIndex(owner.clone()), &ids);
    }

    /// Remove `id` from `owner`'s OwnerIndex list.
    fn deindex_owner(env: &Env, owner: &Address, id: u64) {
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerIndex(owner.clone()))
            .unwrap_or_else(|| Vec::new(env));

        // Vec in soroban-sdk is append-only by default; build a new list.
        let mut i: u32 = 0;
        let mut out: Vec<u64> = Vec::new(env);
        while i < ids.len() {
            let cur = ids.get(i).unwrap();
            if cur != id {
                out.push_back(cur);
            }
            i += 1;
        }

        env.storage()
            .persistent()
            .set(&DataKey::OwnerIndex(owner.clone()), &out);
    }

    fn yield_pool_balance(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::YieldPool)
            .unwrap_or(0)
    }

    fn set_yield_pool_balance(env: &Env, amount: i128) {
        env.storage().instance().set(&DataKey::YieldPool, &amount);
    }

    fn token_client(env: &Env) -> soroban_sdk::token::Client {
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("token not configured");
        soroban_sdk::token::Client::new(env, &token)
    }

    /// Categorize a free-form dispute reason string into a DisputeReason enum.
    /// Uses keyword matching to detect common dispute categories.
    fn categorize_dispute_reason(reason: &String) -> DisputeReason {
        let reason_lower = reason.to_lowercase();
        
        // Check for keywords in order of specificity.
        if reason_lower.contains("value") || reason_lower.contains("mismatch") 
            || reason_lower.contains("amount") || reason_lower.contains("delivered") {
            DisputeReason::ValueMismatch
        } else if reason_lower.contains("compliance") || reason_lower.contains("attestation")
            || reason_lower.contains("failed") || reason_lower.contains("violation") {
            DisputeReason::NonCompliance
        } else if reason_lower.contains("fraud") || reason_lower.contains("unauthorized")
            || reason_lower.contains("suspicious") || reason_lower.contains("suspicious") {
            DisputeReason::FraudSuspicion
        } else if reason_lower.contains("operational") || reason_lower.contains("failure")
            || reason_lower.contains("delivery") {
            DisputeReason::OperationalFailure
        } else {
            DisputeReason::Other
        }
    }
}

mod test;
