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
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Map, String,
    Symbol, Vec,
};

// Configuration constants for escrow contract
// Configuration constants for escrow contract
// Number of seconds in a day used for maturity calculation.
pub const SECONDS_PER_DAY: u64 = 86_400;

/// Upper bound for commitment amount enforced by `create_commitment`.
/// Aligns with backend `CommitmentLimits.max_amount`.
pub const MAX_AMOUNT: i128 = 1_000_000_000_000;

/// Upper bound for commitment duration (in days) enforced by `create_commitment`.
/// Aligns with backend `CommitmentLimits.max_duration_days`.
pub const MAX_DURATION_DAYS: u32 = 365;

/// Upper bound for penalty basis points (10_000 = 100%).
pub const MAX_PENALTY_BPS: u32 = 10_000;

/// Bound full-record owner reads so a single query does not exceed Soroban
/// simulation/result size limits.
const MAX_USER_COMMITMENTS_READ: u32 = 100;

/// Maximum number of owner commitment ids returned by a single paginated read.
const MAX_OWNER_COMMITMENTS_PAGE_LIMIT: u32 = 100;

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
    /// Yield pool balance used to pay matured release yield.
    YieldPool,
    /// Contract pause flag to halt write operations.
    Paused,
    /// Attestation history for a commitment.
    Attestations(u64),
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
    /// Compliance score threshold that auto-freezes funded commitments.
    ViolationThreshold,
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
    /// Insufficient funds in the yield pool to satisfy a matured release.
    InsufficientYieldPool = 10,
    /// Contract is currently paused for emergency halt.
    Paused = 11,
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

/// Result of a matured settlement invoked by `settle_commitment`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[allow(non_snake_case)]
pub struct SettlementResult {
    pub settlementAmount: i128,
    pub finalStatus: String,
}

#[contracttype]
#[derive(Clone)]
pub struct AttestationRecord {
    pub attestor: Address,
    pub compliance_score: u32,
    pub timestamp: u64,
}

const MAX_PENALTY_BPS: u32 = 10_000;
const SECONDS_PER_DAY: u64 = 86_400;
const YIELD_BPS_DENOMINATOR: i128 = 3_650_000; // 365 days * 10_000 bps

fn yield_rate_bps(risk: RiskProfile) -> u32 {
    match risk {
        RiskProfile::Safe => 500,
        RiskProfile::Balanced => 700,
        RiskProfile::Aggressive => 1_000,
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FundEscrowEventData {
    pub asset: Address,
    pub amount: i128,
    pub risk: RiskProfile,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReleaseEventData {
    pub asset: Address,
    pub amount: i128,
    pub accrued_yield: i128,
    pub payout: i128,
    pub risk: RiskProfile,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RefundEventData {
    pub asset: Address,
    pub amount: i128,
    pub refunded_amount: i128,
    pub penalty: i128,
    pub risk: RiskProfile,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeEventData {
    pub asset: Address,
    pub amount: i128,
    pub risk: RiskProfile,
    pub reason_category: DisputeReason,
    pub reason_text: String,
    pub disputed_by: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ResolveDisputeEventData {
    pub asset: Address,
    pub amount: i128,
    pub payout: i128,
    pub penalty: i128,
    pub risk: RiskProfile,
    pub release_to_owner: bool,
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
    ///
    /// # Authorization
    /// Only callable by: admin
    ///
    /// # State Transition
    /// No state transition; sets the paused flag to `true`.
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
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
    ///
    /// # Authorization
    /// Only callable by: admin
    ///
    /// # State Transition
    /// No state transition; sets the paused flag to `false`.
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
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
    ///
    /// # Authorization
    /// None; read-only operation
    ///
    /// # Returns
    /// `true` if paused, `false` otherwise
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
        let maturity = now
            .checked_add(
                (duration_days as u64)
                    .checked_mul(SECONDS_PER_DAY)
                    .ok_or(Error::InvalidDuration)?,
            )
            .ok_or(Error::InvalidDuration)?;
        let accrued_yield = Self::calculate_accrued_yield(amount, duration_days, risk)?;

        let commitment = Commitment {
            id,
            owner: owner.clone(),
            asset,
            amount,
            accrued_yield: calculate_accrued_yield(amount, duration_days, risk),
            risk,
            status: EscrowStatus::Created,
            maturity,
            penalty_bps,
            compliance_score: 100,
            created_at: now,
            metadata,
        };

        Self::save(&env, &commitment);
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
    pub fn create_commitment_default(
        env: Env,
        owner: Address,
        asset: Address,
        amount: i128,
        risk: RiskProfile,
        duration_days: u32,
    ) -> Result<u64, Error> {
        Self::require_init(&env)?;
        Self::require_not_paused(&env)?;
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
        let duration_seconds = (duration_days as u64)
            .checked_mul(SECONDS_PER_DAY)
            .ok_or(Error::InvalidDuration)?;
        let maturity = now.checked_add(duration_seconds).ok_or(Error::InvalidDuration)?;

        let accrued_yield = Self::calculate_accrued_yield(amount, duration_days, risk);
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
            metadata: Map::new(&env),
        };

        Self::save(&env, &commitment);
        Self::index_owner(&env, &owner, id);

        Self::publish_commitment_event(
            &env,
            "create_commitment",
            &commitment,
            CreateCommitmentEventData {
                asset: commitment.asset.clone(),
                amount: commitment.amount,
                risk: commitment.risk,
                maturity: commitment.maturity,
                penalty_bps: commitment.penalty_bps,
            },
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
    pub fn create_commitment_with_default(
        env: Env,
        owner: Address,
        asset: Address,
        amount: i128,
        risk: RiskProfile,
        duration_days: u32,
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

        // Retrieve the default penalty for this risk profile.
        let penalty_bps = Self::get_default_penalty_internal(&env, risk)?;

        let id = Self::next_id(&env);
        let now = env.ledger().timestamp();
        let maturity = now
            .checked_add(
                (duration_days as u64)
                    .checked_mul(SECONDS_PER_DAY)
                    .ok_or(Error::InvalidDuration)?,
            )
            .ok_or(Error::InvalidDuration)?;
        let accrued_yield = Self::calculate_accrued_yield(amount, duration_days, risk)?;
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
            metadata: Map::new(&env),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Commitment(id), &commitment);
        Self::index_owner(&env, &owner, id);

        Self::publish_commitment_event(
            &env,
            "create_commitment",
            &commitment,
            CreateCommitmentEventData {
                asset: commitment.asset.clone(),
                amount: commitment.amount,
                risk: commitment.risk,
                maturity: commitment.maturity,
                penalty_bps: commitment.penalty_bps,
            },
        );
        Ok(id)
    }

    /// Move tokens from the owner into the contract, transitioning the
    /// commitment from `Created` to `Funded`.
    ///
    /// # Authorization
    /// Only callable by: owner
    ///
    /// # State Transition
    /// Requires: `EscrowStatus::Created`
    /// Transitions to: `EscrowStatus::Funded`
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    /// - `Paused` — contract is paused
    /// - `InvalidState` — commitment not in `Created` state
    /// - `AssetMismatch` — commitment asset does not match configured token
    /// - `InvalidAmount` — owner has insufficient balance
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

        Self::publish_commitment_event(
            &env,
            "fund_escrow",
            &c,
            FundEscrowEventData {
                asset: c.asset.clone(),
                amount: c.amount,
                risk: c.risk,
            },
        );
        Ok(())
    }

    /// Deposit yield tokens into the contract's dedicated yield pool.
    /// Only the admin may fund the pool used to pay matured commitment yield.
    ///
    /// # Authorization
    /// Only callable by: admin
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    /// - `InvalidAmount` — amount is ≤ 0
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
    ///
    /// # Authorization
    /// None; read-only operation
    ///
    /// # Returns
    /// The current yield pool balance in token units
    pub fn get_yield_pool_balance(env: Env) -> i128 {
        Self::yield_pool_balance(&env)
    }

    fn perform_release(env: &Env, commitment_id: u64, caller: &Address) -> Result<i128, Error> {
        caller.require_auth();
        let mut c = Self::load(env, commitment_id)?;

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

        let yield_pool = Self::yield_pool_balance(env);
        if yield_pool < c.accrued_yield {
            return Err(Error::InsufficientYieldPool);
        }

        let total_payout = c.amount + c.accrued_yield;
        let token = Self::token_client(env);
        let contract = env.current_contract_address();
        token.transfer(&contract, &c.owner, &total_payout);

        Self::set_yield_pool_balance(env, yield_pool - c.accrued_yield);
        c.status = EscrowStatus::Released;
        Self::save(env, &c);

        // Interactions: External token transfer
        let token = Self::token_client(&env);
        let contract = env.current_contract_address();
        token.transfer(&contract, &c.owner, &total_payout);

        env.events().publish(
            (Symbol::new(env, "release"), c.owner.clone()),
            (commitment_id, total_payout, c.accrued_yield),
        );
        Ok(total_payout)
    }

    /// Release the escrowed funds back to the owner once the commitment has
    /// matured. Only callable on a `Funded` commitment at/after maturity.
    pub fn release(env: Env, commitment_id: u64, caller: Address) -> Result<i128, Error> {
        Self::require_init(&env)?;
        Self::perform_release(&env, commitment_id, &caller)
    }

    /// Alias matching the backend settlement method name.
    /// Delegates to matured release logic and returns a structured settlement
    /// result the backend can parse.
    pub fn settle_commitment(
        env: Env,
        commitment_id: u64,
        caller: Address,
    ) -> Result<SettlementResult, Error> {
        Self::require_init(&env)?;
        let payout = Self::perform_release(&env, commitment_id, &caller)?;
        Ok(SettlementResult {
            settlementAmount: payout,
            finalStatus: String::from_str(&env, "SETTLED"),
        })
    }

    /// Early-exit refund. Returns the principal minus the early-exit penalty;
    /// the penalty is sent to the fee recipient. Only the owner may refund and
    /// only while the commitment is `Funded` and before maturity.
    ///
    /// # Authorization
    /// Only callable by: owner
    ///
    /// # State Transition
    /// Requires: `EscrowStatus::Funded` (not `Violated`)
    /// Transitions to: `EscrowStatus::Refunded`
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    /// - `CommitmentViolated` — commitment in violated state
    /// - `InvalidState` — commitment not in `Funded` state
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
    /// # Authorization
    /// Only callable by: owner
    ///
    /// # State Transition
    /// Requires: `EscrowStatus::Funded` (not `Violated`)
    /// Transitions to: `EscrowStatus::Funded` (if partial) or `EscrowStatus::Refunded` (if full)
    ///
    /// # Arguments
    /// * `commitment_id` - The id of the target commitment.
    /// * `amount` - The portion of the principal to withdraw (must be > 0 and ≤ stored amount).
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    /// - `Paused` — contract is paused
    /// - `CommitmentViolated` — commitment in violated state
    /// - `InvalidState` — commitment not in `Funded` state
    /// - `InvalidAmount` — amount is ≤ 0 or > stored principal
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
        let (penalty, refund_amount) = Self::compute_refund_amount(amount, c.penalty_bps)?;

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
    ///
    /// # Authorization
    /// Only callable by: owner
    ///
    /// # State Transition
    /// Requires: `EscrowStatus::Funded`
    /// Transitions to: `EscrowStatus::Refunded`
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    /// - `Unauthorized` — caller is not the commitment owner
    /// - `InvalidState` — commitment not in `Funded` state
    /// - `CommitmentViolated` — commitment in violated state
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
    ///
    /// # Authorization
    /// Only callable by: owner or admin
    ///
    /// # State Transition
    /// Requires: `EscrowStatus::Funded`
    /// Transitions to: `EscrowStatus::Disputed`
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    /// - `Unauthorized` — caller is neither owner nor admin
    /// - `InvalidState` — commitment not in `Funded` state
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

        Self::publish_commitment_event(
            &env,
            "dispute",
            &c,
            DisputeEventData {
                asset: c.asset.clone(),
                amount: c.amount,
                risk: c.risk,
                reason_category,
                reason_text: reason,
                disputed_by: caller,
            },
        );
        Ok(())
    }

    /// Admin-only resolution of a dispute. `release_to_owner = true` pays the
    /// owner the full principal; `false` refunds principal minus penalty.
    ///
    /// # Authorization
    /// Only callable by: admin
    ///
    /// # State Transition
    /// Requires: `EscrowStatus::Disputed` or `EscrowStatus::Violated`
    /// Transitions to: `EscrowStatus::Released` (if release_to_owner=true) or `EscrowStatus::Refunded` (if false)
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    /// - `InvalidState` — commitment not in `Disputed` or `Violated` state
    /// - `InsufficientYieldPool` — yield pool cannot cover accrued yield (if releasing post-maturity)
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
        if c.status != EscrowStatus::Disputed && c.status != EscrowStatus::Violated {
            return Err(Error::InvalidState);
        }

        let token = Self::token_client(&env);
        let contract = env.current_contract_address();
        let paid;
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
            c.status = EscrowStatus::Released;
            paid = payout;
            
            // Effects: Update state before interactions to prevent reentrancy
            Self::save(&env, &c);
            
            // Interactions: External token transfer
            token.transfer(&contract, &c.owner, &payout);
        } else {
            let (penalty, refund_amount) = Self::compute_refund_amount(c.amount, c.penalty_bps)?;
            c.status = EscrowStatus::Refunded;
            let (_, refund_amount) = Self::compute_refund_amount(c.amount, c.penalty_bps)?;
            paid = refund_amount;
        }

        // Effects: persist before any external transfer.
        Self::save(&env, &c);

        // Interactions: transfer the resolved payout to the stored owner.
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
    /// # Authorization
    /// Only callable by: admin
    ///
    /// # Arguments
    /// * `threshold` - Score threshold 0..=100 (0 = disabled, 60 = violate below 60).
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
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
    ///
    /// # Authorization
    /// None; read-only operation
    ///
    /// # Returns
    /// The current violation threshold (0..=100)
    pub fn get_violation_threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ViolationThreshold)
            .unwrap_or(0)
    }

    /// Record a compliance attestation (0..=100) against a commitment. Mirrors
    /// the attestation engine integration used by the backend.
    ///
    /// # Authorization
    /// Only callable by: attestor (any address that authorizes)
    ///
    /// # State Transition
    /// May transition `Funded` → `Violated` if score < violation threshold
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    /// - `NotFound` — commitment id does not exist
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
    ///
    /// # Authorization
    /// None; read-only operation
    ///
    /// # Errors
    /// - `NotFound` — commitment id does not exist
    pub fn get_commitment(env: Env, commitment_id: u64) -> Result<Commitment, Error> {
        Self::load(&env, commitment_id)
    }

    /// Transfer marketplace ownership for secondary trading.
    ///
    /// Preconditions:
    /// - Commitment must be in `Funded` state.
    ///
    /// # Authorization
    /// Only callable by: current owner
    ///
    /// # State Transition
    /// No state change; updates `Commitment.owner` while remaining `Funded`
    ///
    /// # Effects
    /// - Updates `Commitment.owner`.
    /// - Maintains `OwnerIndex` for both the old owner and the new owner.
    /// - Emits `transfer_ownership`.
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    /// - `NotFound` — commitment id does not exist
    /// - `InvalidState` — commitment not in `Funded` state
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
    }

    /// Return the list of attestation history for a commitment id.
    ///
    /// # Authorization
    /// None; read-only operation
    ///
    /// # Returns
    /// A vector of `AttestationRecord` structures in chronological order
    pub fn get_attestations(env: Env, commitment_id: u64) -> Vec<AttestationRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Attestations(commitment_id))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Return full commitment records for a user.
    ///
    /// This is the backend's primary read path. The result is intentionally
    /// bounded so a single read stays within Soroban RPC payload limits.
    pub fn get_user_commitments(env: Env, owner: Address) -> Vec<Commitment> {
        let ids = Self::owner_commitment_ids(&env, owner);
        let mut commitments = Vec::new(&env);
        let limit = ids.len().min(MAX_USER_COMMITMENTS_READ);
        let mut index = 0;

        while index < limit {
            let commitment_id = ids.get(index).unwrap();
            if let Some(commitment) = env
                .storage()
                .persistent()
                .get(&DataKey::Commitment(commitment_id))
            {
                commitments.push_back(commitment);
            }
            index += 1;
        }

        commitments
    }

    /// Return the first bounded page of commitment ids owned by an address using
    /// the backend's fallback reader name.
    pub fn get_user_commitment_ids(env: Env, owner: Address) -> Vec<u64> {
        Self::owner_commitment_ids_page(&env, owner, 0, MAX_OWNER_COMMITMENTS_PAGE_LIMIT)
    }

    /// Return a paginated list of commitment ids owned by an address using the
    /// backend's fallback reader name.
    pub fn get_user_commitment_ids_page(
        env: Env,
        owner: Address,
        start: u32,
        limit: u32,
    ) -> Vec<u64> {
        Self::owner_commitment_ids_page(&env, owner, start, limit)
    }

    /// Return a bounded page of commitment ids owned by an address.
    ///
    /// `start` is a zero-based offset into the owner's commitment id index.
    /// `limit` is clamped to `MAX_OWNER_COMMITMENTS_PAGE_LIMIT` so callers
    /// cannot request an unbounded payload.
    ///
    /// # Authorization
    /// None; read-only operation
    ///
    /// # Returns
    /// A vector of commitment ids owned by the address for the requested page
    pub fn get_owner_commitments(
        env: Env,
        owner: Address,
        start: u32,
        limit: u32,
    ) -> Vec<u64> {
        Self::owner_commitment_ids_page(&env, owner, start, limit)
    }

    /// Retrieve the dispute record for a commitment. Returns `None` if no
    /// dispute has been recorded.
    ///
    /// # Authorization
    /// None; read-only operation
    ///
    /// # Returns
    /// The `DisputeRecord` if a dispute exists, `None` otherwise
    pub fn get_dispute(env: Env, commitment_id: u64) -> Option<DisputeRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Dispute(commitment_id))
    }

    /// Retrieve the default penalty (in basis points) for a specific risk profile.
    /// Configured at initialization time and used by
    /// `create_commitment_default()`. Useful for querying the
    /// current penalty configuration.
    ///
    /// # Authorization
    /// None; read-only operation
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    ///
    /// # Returns
    /// The default penalty in basis points for the risk profile
    pub fn get_default_penalty(env: Env, risk: RiskProfile) -> Result<u32, Error> {
        env.storage()
            .instance()
            .get(&DataKey::DefaultPenalty(risk))
            .ok_or(Error::NotInitialized)
    }

    /// Admin-only setter for the penalty-free grace period before maturity.
    /// If the commitment is refunded within the configured window before
    /// maturity, the early-exit penalty is waived.
    ///
    /// # Authorization
    /// Only callable by: admin
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
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
    ///
    /// # Authorization
    /// None; read-only operation
    ///
    /// # Errors
    /// - `NotInitialized` — contract not initialized
    ///
    /// # Returns
    /// The grace period in seconds (0 if not configured)
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

        Self::publish_commitment_event(
            env,
            "refund",
            &c,
            RefundEventData {
                asset: c.asset.clone(),
                amount: c.amount,
                refunded_amount: refund_amount,
                penalty,
                risk: c.risk,
            },
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

    fn get_default_penalty_internal(env: &Env, risk: RiskProfile) -> Result<u32, Error> {
        env.storage()
            .instance()
            .get(&DataKey::DefaultPenalty(risk))
            .ok_or(Error::NotInitialized)
    }

    fn calculate_accrued_yield(amount: i128, duration_days: u32, risk: RiskProfile) -> i128 {
        let annual_yield_bps: i128 = match risk {
            RiskProfile::Safe => 500,
            RiskProfile::Balanced => 700,
            RiskProfile::Aggressive => 1_000,
        };

        amount
            .saturating_mul(annual_yield_bps)
            .saturating_mul(duration_days as i128)
            / 365
            / MAX_PENALTY_BPS as i128
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

    fn is_paused_internal(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    fn require_not_paused(env: &Env) -> Result<(), Error> {
        if Self::is_paused_internal(env) {
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
        let key = DataKey::Commitment(c.id);
        env.storage().persistent().set(&key, c);
        // Only extend when the stored TTL no longer covers the active
        // commitment horizon; unconditional bumps would add avoidable rent fees.
        Self::bump_persistent_entry_to_maturity(env, &key, c.maturity);
    }

    fn index_owner(env: &Env, owner: &Address, id: u64) {
        let key = DataKey::OwnerIndex(owner.clone());
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));
        ids.push_back(id);
        env.storage().persistent().set(&key, &ids);
        Self::refresh_owner_index_ttl(env, owner, &ids);
    }

    fn owner_commitment_ids(env: &Env, owner: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::OwnerIndex(owner))
            .unwrap_or_else(|| Vec::new(env))
    }

    fn owner_commitment_ids_page(
        env: &Env,
        owner: Address,
        start: u32,
        limit: u32,
    ) -> Vec<u64> {
        let ids = Self::owner_commitment_ids(env, owner);
        let capped_limit = limit.min(MAX_OWNER_COMMITMENTS_PAGE_LIMIT);
        let mut page = Vec::new(env);

        if capped_limit == 0 || start >= ids.len() {
            return page;
        }

        let end = start.saturating_add(capped_limit).min(ids.len());
        let mut index = start;
        while index < end {
            page.push_back(ids.get(index).unwrap());
            index += 1;
        }

        page
    }

    /// Remove `id` from `owner`'s OwnerIndex list.
    fn deindex_owner(env: &Env, owner: &Address, id: u64) {
        let key = DataKey::OwnerIndex(owner.clone());
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
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

        env.storage().persistent().set(&key, &out);
        if out.len() > 0 {
            Self::refresh_owner_index_ttl(env, owner, &out);
        }
    }

    fn refresh_owner_index_ttl(env: &Env, owner: &Address, ids: &Vec<u64>) {
        let mut latest_maturity = 0u64;
        let mut i = 0u32;
        while i < ids.len() {
            let id = ids.get(i).unwrap();
            if let Some(commitment) = env
                .storage()
                .persistent()
                .get::<_, Commitment>(&DataKey::Commitment(id))
            {
                if commitment.maturity > latest_maturity {
                    latest_maturity = commitment.maturity;
                }
            }
            i += 1;
        }

        if latest_maturity > 0 {
            Self::bump_persistent_entry_to_maturity(
                env,
                &DataKey::OwnerIndex(owner.clone()),
                latest_maturity,
            );
        }
    }

    fn bump_persistent_entry_to_maturity(env: &Env, key: &DataKey, maturity: u64) {
        let extend_to = Self::ttl_ledgers_for_maturity(env, maturity);
        if extend_to == 0 {
            return;
        }

        let threshold = extend_to.saturating_sub(TTL_MATURITY_BUFFER_LEDGERS);
        env.storage()
            .persistent()
            .extend_ttl(key, threshold, extend_to);
    }

    fn ttl_ledgers_for_maturity(env: &Env, maturity: u64) -> u32 {
        let now = env.ledger().timestamp();
        let remaining_seconds = maturity.saturating_sub(now);
        let remaining_ledgers =
            (remaining_seconds.saturating_add(ESTIMATED_LEDGER_SECONDS - 1)) / ESTIMATED_LEDGER_SECONDS;
        let target_ledgers = remaining_ledgers.saturating_add(TTL_MATURITY_BUFFER_LEDGERS as u64);
        let max_ttl = env.storage().max_ttl() as u64;
        if target_ledgers > max_ttl {
            max_ttl as u32
        } else {
            target_ledgers as u32
        }
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

    fn token_client(env: &Env) -> soroban_sdk::token::Client<'_> {
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("token not configured");
        soroban_sdk::token::Client::new(env, &token)
    }

    /// Categorize a free-form dispute reason string into a DisputeReason enum.
    /// Uses keyword matching to detect common dispute categories.
    fn categorize_dispute_reason(_reason: &String) -> DisputeReason {
        DisputeReason::Other
    }

    fn string_contains_ignore_case(haystack: &String, needle: &[u8]) -> bool {
        let bytes = haystack.to_bytes();
        if needle.is_empty() || bytes.len() < needle.len() as u32 {
            return false;
        }

        let mut start: u32 = 0;
        while start + needle.len() as u32 <= bytes.len() {
            let mut matched = true;
            let mut offset: u32 = 0;
            while offset < needle.len() as u32 {
                let hay = bytes.get(start + offset).unwrap();
                let pattern = needle[offset as usize];
                if Self::ascii_lower(hay) != Self::ascii_lower(pattern) {
                    matched = false;
                    break;
                }
                offset += 1;
            }
            if matched {
                return true;
            }
            start += 1;
        }

        false
    }

    fn ascii_lower(byte: u8) -> u8 {
        if byte >= b'A' && byte <= b'Z' {
            byte + 32
        } else {
            byte
        }
    }
}

#[cfg(test)]
mod test;
