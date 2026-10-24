import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




/**
 * Errors returned to the caller. Numeric codes are stable and surfaced by the
 * backend `normalizeContractError` mapper.
 */
export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"NotFound"},
  4: {message:"Unauthorized"},
  5: {message:"InvalidAmount"},
  6: {message:"InvalidState"},
  7: {message:"NotMatured"},
  8: {message:"InvalidDuration"},
  9: {message:"PenaltyTooHigh"},
  /**
   * Insufficient funds in the yield pool to satisfy a matured release.
   */
  10: {message:"InsufficientYieldPool"},
  /**
   * Contract is currently paused for emergency halt.
   */
  11: {message:"Paused"},
  /**
   * Asset does not match the configured escrow token.
   */
  12: {message:"AssetMismatch"},
  /**
   * Owner has insufficient balance to fund the commitment.
   */
  13: {message:"InsufficientBalance"},
  /**
   * Commitment is in a violated state and cannot be released.
   */
  14: {message:"CommitmentViolated"},
  /**
   * Provided wasm hash is invalid (e.g. zero hash).
   */
  15: {message:"InvalidWasmHash"},
  /**
   * The commitment's funding window has elapsed.
   */
  16: {message:"FundingWindowExpired"},
  /**
   * Yield reservation accounting invariant is broken (e.g. reserved balance
   * cannot cover a commitment that was funded with a reservation).
   */
  17: {message:"ReservedYieldInvariant"}
}

/**
 * Storage keys for persistent contract state.
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "Token", values: void} | {tag: "NextId", values: void} | {tag: "Commitment", values: readonly [u64]} | {tag: "OwnerIndex", values: readonly [string]} | {tag: "FeeRecipient", values: void} | {tag: "YieldPool", values: void} | {tag: "ReservedYield", values: void} | {tag: "Reserved", values: readonly [u64]} | {tag: "Paused", values: void} | {tag: "Attestations", values: readonly [u64]} | {tag: "Dispute", values: readonly [u64]} | {tag: "DefaultPenalty", values: readonly [RiskProfile]} | {tag: "GracePeriodSeconds", values: void} | {tag: "ViolationThreshold", values: void};


/**
 * A single escrow / commitment record.
 */
export interface Commitment {
  accrued_yield: i128;
  amount: i128;
  asset: string;
  /**
 * Compliance score 0..=100 recorded by the attestation engine.
 */
compliance_score: u32;
  created_at: u64;
  id: u64;
  /**
 * Ledger timestamp (seconds) at which the commitment may be released.
 */
maturity: u64;
  /**
 * Arbitrary key-value metadata supplied at creation time (e.g. risk notes,
 * off-chain context). Keys and values are both `String`. Empty by default.
 */
metadata: Map<string, string>;
  owner: string;
  /**
 * Early-exit penalty in basis points (e.g. 200 = 2%).
 */
penalty_bps: u32;
  risk: RiskProfile;
  status: EscrowStatus;
}

/**
 * Risk profile chosen at creation time. Determines the early-exit penalty
 * applied during `refund`.
 */
export type RiskProfile = {tag: "Safe", values: void} | {tag: "Balanced", values: void} | {tag: "Aggressive", values: void};

/**
 * Lifecycle status of a commitment escrow.
 */
export type EscrowStatus = {tag: "Created", values: void} | {tag: "Funded", values: void} | {tag: "Released", values: void} | {tag: "Refunded", values: void} | {tag: "Disputed", values: void} | {tag: "Violated", values: void} | {tag: "Cancelled", values: void};

/**
 * Categorized dispute reason enum. Enables efficient on-chain classification
 * and off-chain indexing of disputes by category.
 */
export enum DisputeReason {
  ValueMismatch = 0,
  NonCompliance = 1,
  FraudSuspicion = 2,
  OperationalFailure = 3,
  Other = 4,
}


/**
 * Dispute record: stores both the categorized reason and the free-form
 * reason string for audit and detailed context.
 */
export interface DisputeRecord {
  /**
 * Timestamp when the dispute was opened.
 */
disputed_at: u64;
  /**
 * Address that initiated the dispute (owner or admin).
 */
disputed_by: string;
  /**
 * Categorized reason for the dispute.
 */
reason_category: DisputeReason;
  /**
 * Free-form reason string for detailed explanation and audit.
 */
reason_text: string;
}


/**
 * Result of an early exit commitment.
 */
export interface EarlyExitResult {
  exit_amount: i128;
  final_status: EscrowStatus;
  penalty_amount: i128;
}


export interface RefundEventData {
  amount: i128;
  asset: string;
  penalty: i128;
  refunded_amount: i128;
  risk: RiskProfile;
}


/**
 * Snapshot of yield-pool solvency.
 * 
 * `balance` is the total pool balance, `reserved` is the portion already
 * promised to funded commitments, and `available = balance - reserved` is what
 * the admin may withdraw or promise to new commitments.
 */
export interface YieldPoolStatus {
  available: i128;
  balance: i128;
  reserved: i128;
}


export interface DisputeEventData {
  amount: i128;
  asset: string;
  disputed_by: string;
  reason_category: DisputeReason;
  reason_text: string;
  risk: RiskProfile;
}


export interface ReleaseEventData {
  accrued_yield: i128;
  amount: i128;
  asset: string;
  payout: i128;
  risk: RiskProfile;
}


/**
 * Result of a matured settlement invoked by `settle_commitment`.
 */
export interface SettlementResult {
  final_status: string;
  settlement_amount: i128;
}


/**
 * Historical compliance attestation stored against a commitment.
 */
export interface AttestationRecord {
  attestor: string;
  compliance_score: u32;
  timestamp: u64;
}


export interface FundEscrowEventData {
  amount: i128;
  asset: string;
  risk: RiskProfile;
}


export interface ResolveDisputeEventData {
  amount: i128;
  asset: string;
  payout: i128;
  penalty: i128;
  release_to_owner: boolean;
  risk: RiskProfile;
}


export interface CreateCommitmentEventData {
  amount: i128;
  asset: string;
  maturity: u64;
  penalty_bps: u32;
  risk: RiskProfile;
}

export interface Client {
  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pause contract writes. Admin only.
   */
  pause: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Early-exit refund. Returns the principal minus the early-exit penalty.
   */
  refund: ({commitment_id}: {commitment_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Flag a funded commitment as disputed, freezing release/refund until an
   * admin resolves it.
   */
  dispute: ({commitment_id, caller, reason}: {commitment_id: u64, caller: string, reason: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a release transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Release the escrowed funds back to the owner once the commitment has matured.
   */
  release: ({commitment_id, caller}: {commitment_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Resume contract writes after an emergency pause. Admin only.
   */
  unpause: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the escrow contract to a new WASM implementation. Admin only.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return whether the contract is currently paused.
   */
  is_paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update the contract admin. Only the current admin may call this.
   * 
   * # Authorization
   * Only callable by: current admin
   * 
   * # Errors
   * - `NotInitialized` — contract not initialized
   * - `Unauthorized` — caller is not the current admin
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One-time initialization. Sets the admin, the escrow token, fee recipient,
   * and default penalty rates for each risk profile.
   */
  initialize: ({admin, token, fee_recipient, safe_default_penalty_bps, balanced_default_penalty_bps, aggressive_default_penalty_bps}: {admin: string, token: string, fee_recipient: string, safe_default_penalty_bps: u32, balanced_default_penalty_bps: u32, aggressive_default_penalty_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a fund_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Move tokens from the owner into the contract, transitioning `Created` → `Funded`.
   */
  fund_escrow: ({commitment_id}: {commitment_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Retrieve the dispute record for a commitment.
   */
  get_dispute: ({commitment_id}: {commitment_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<DisputeRecord>>>

  /**
   * Construct and simulate a get_commitment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read a single commitment record.
   */
  get_commitment: ({commitment_id}: {commitment_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Commitment>>>

  /**
   * Construct and simulate a refund_partial transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Partial early-exit refund. Withdraws `amount` from the escrowed principal,
   * applying the proportional `penalty_bps` to the withdrawn portion only.
   */
  refund_partial: ({commitment_id, amount}: {commitment_id: u64, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a resolve_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin-only resolution of a dispute.
   */
  resolve_dispute: ({commitment_id, release_to_owner}: {commitment_id: u64, release_to_owner: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_attestations transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the attestation history for a commitment id.
   */
  get_attestations: ({commitment_id}: {commitment_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<AttestationRecord>>>

  /**
   * Construct and simulate a get_grace_period transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the currently configured penalty-free grace period in seconds.
   */
  get_grace_period: (options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a set_grace_period transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin-only setter for the penalty-free grace period before maturity.
   */
  set_grace_period: ({admin, grace_period_seconds}: {admin: string, grace_period_seconds: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel_commitment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel an unfunded commitment. Before the funding deadline only its
   * owner may cancel with authorization; after expiry cancellation is
   * permissionless, including while contract writes are paused.
   */
  cancel_commitment: ({commitment_id, caller}: {commitment_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_commitment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a new (unfunded) commitment escrow. Returns the new commitment id.
   */
  create_commitment: ({owner, asset, amount, risk, duration_days, penalty_bps, metadata}: {owner: string, asset: string, amount: i128, risk: RiskProfile, duration_days: u32, penalty_bps: u32, metadata: Map<string, string>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a set_fee_recipient transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update the fee recipient. Only the current admin may call this.
   * 
   * # Authorization
   * Only callable by: admin
   * 
   * # Errors
   * - `NotInitialized` — contract not initialized
   */
  set_fee_recipient: ({new_fee_recipient}: {new_fee_recipient: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a settle_commitment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Alias matching the backend settlement method name. Delegates to matured
   * release logic and returns a structured settlement result.
   */
  settle_commitment: ({commitment_id, caller}: {commitment_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<SettlementResult>>>

  /**
   * Construct and simulate a deposit_yield_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit yield tokens into the contract's dedicated yield pool. Admin only.
   */
  deposit_yield_pool: ({admin, amount}: {admin: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a record_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Record a compliance attestation (0..=100) against a commitment.
   */
  record_attestation: ({commitment_id, attestor, compliance_score}: {commitment_id: u64, attestor: string, compliance_score: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfer marketplace ownership for secondary trading.
   */
  transfer_ownership: ({commitment_id, new_owner}: {commitment_id: u64, new_owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_default_penalty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Retrieve the default penalty (in basis points) for a specific risk profile.
   */
  get_default_penalty: ({risk}: {risk: RiskProfile}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a withdraw_yield_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw unallocated yield-pool surplus to `to`. Admin only.
   * 
   * Only the available portion (`balance - reserved`) may be withdrawn, so
   * yield already promised to funded commitments can never be drained.
   */
  withdraw_yield_pool: ({to, amount}: {to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_user_commitments transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return full commitment records for a user (bounded).
   */
  get_user_commitments: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Commitment>>>

  /**
   * Construct and simulate a early_exit_commitment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Process an early exit for a commitment. Returns a structured result.
   */
  early_exit_commitment: ({commitment_id, caller}: {commitment_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<EarlyExitResult>>>

  /**
   * Construct and simulate a get_owner_commitments transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return a bounded page of commitment ids owned by an address.
   */
  get_owner_commitments: ({owner, start, limit}: {owner: string, start: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a get_yield_pool_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read the pool balance, the reserved (promised) portion, and the
   * available portion an admin may withdraw or promise to new commitments.
   */
  get_yield_pool_status: (options?: MethodOptions) => Promise<AssembledTransaction<YieldPoolStatus>>

  /**
   * Construct and simulate a get_yield_pool_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read the current yield pool balance.
   */
  get_yield_pool_balance: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_user_commitment_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the first bounded page of commitment ids owned by an address.
   */
  get_user_commitment_ids: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a get_violation_threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the current violation threshold (0..=100).
   */
  get_violation_threshold: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a set_violation_threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set the minimum compliance score threshold for auto-violation. Admin only.
   */
  set_violation_threshold: ({threshold}: {threshold: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_commitment_default transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a new (unfunded) commitment using the default penalty for the risk profile.
   * 
   * Inherits `penalty_bps` from the risk profile defaults configured at
   * initialization time. Use `create_commitment()` for an explicit override.
   */
  create_commitment_default: ({owner, asset, amount, risk, duration_days}: {owner: string, asset: string, amount: i128, risk: RiskProfile, duration_days: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a get_user_commitment_ids_page transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return a paginated list of commitment ids owned by an address.
   */
  get_user_commitment_ids_page: ({owner, start, limit}: {owner: string, start: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a create_commitment_with_default transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Alias for `create_commitment_default`. Provided for backward compatibility.
   */
  create_commitment_with_default: ({owner, asset, amount, risk, duration_days}: {owner: string, asset: string, amount: i128, risk: RiskProfile, duration_days: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAHRFcnJvcnMgcmV0dXJuZWQgdG8gdGhlIGNhbGxlci4gTnVtZXJpYyBjb2RlcyBhcmUgc3RhYmxlIGFuZCBzdXJmYWNlZCBieSB0aGUKYmFja2VuZCBgbm9ybWFsaXplQ29udHJhY3RFcnJvcmAgbWFwcGVyLgAAAAAAAAAFRXJyb3IAAAAAAAARAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAAhOb3RGb3VuZAAAAAMAAAAAAAAADFVuYXV0aG9yaXplZAAAAAQAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAAFAAAAAAAAAAxJbnZhbGlkU3RhdGUAAAAGAAAAAAAAAApOb3RNYXR1cmVkAAAAAAAHAAAAAAAAAA9JbnZhbGlkRHVyYXRpb24AAAAACAAAAAAAAAAOUGVuYWx0eVRvb0hpZ2gAAAAAAAkAAABCSW5zdWZmaWNpZW50IGZ1bmRzIGluIHRoZSB5aWVsZCBwb29sIHRvIHNhdGlzZnkgYSBtYXR1cmVkIHJlbGVhc2UuAAAAAAAVSW5zdWZmaWNpZW50WWllbGRQb29sAAAAAAAACgAAADBDb250cmFjdCBpcyBjdXJyZW50bHkgcGF1c2VkIGZvciBlbWVyZ2VuY3kgaGFsdC4AAAAGUGF1c2VkAAAAAAALAAAAMUFzc2V0IGRvZXMgbm90IG1hdGNoIHRoZSBjb25maWd1cmVkIGVzY3JvdyB0b2tlbi4AAAAAAAANQXNzZXRNaXNtYXRjaAAAAAAAAAwAAAA2T3duZXIgaGFzIGluc3VmZmljaWVudCBiYWxhbmNlIHRvIGZ1bmQgdGhlIGNvbW1pdG1lbnQuAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAAANAAAAOUNvbW1pdG1lbnQgaXMgaW4gYSB2aW9sYXRlZCBzdGF0ZSBhbmQgY2Fubm90IGJlIHJlbGVhc2VkLgAAAAAAABJDb21taXRtZW50VmlvbGF0ZWQAAAAAAA4AAAAvUHJvdmlkZWQgd2FzbSBoYXNoIGlzIGludmFsaWQgKGUuZy4gemVybyBoYXNoKS4AAAAAD0ludmFsaWRXYXNtSGFzaAAAAAAPAAAALFRoZSBjb21taXRtZW50J3MgZnVuZGluZyB3aW5kb3cgaGFzIGVsYXBzZWQuAAAAFEZ1bmRpbmdXaW5kb3dFeHBpcmVkAAAAEAAAAIZZaWVsZCByZXNlcnZhdGlvbiBhY2NvdW50aW5nIGludmFyaWFudCBpcyBicm9rZW4gKGUuZy4gcmVzZXJ2ZWQgYmFsYW5jZQpjYW5ub3QgY292ZXIgYSBjb21taXRtZW50IHRoYXQgd2FzIGZ1bmRlZCB3aXRoIGEgcmVzZXJ2YXRpb24pLgAAAAAAFlJlc2VydmVkWWllbGRJbnZhcmlhbnQAAAAAABE=",
        "AAAAAgAAACtTdG9yYWdlIGtleXMgZm9yIHBlcnNpc3RlbnQgY29udHJhY3Qgc3RhdGUuAAAAAAAAAAAHRGF0YUtleQAAAAAPAAAAAAAAADlDb250cmFjdCBhZG1pbmlzdHJhdG9yIChjYW4gcmVzb2x2ZSBkaXNwdXRlcywgc2V0IHRva2VuKS4AAAAAAAAFQWRtaW4AAAAAAAAAAAAANlRoZSB0b2tlbiAoU0FDKSBhZGRyZXNzIHVzZWQgZm9yIGFsbCBlc2Nyb3cgdHJhbnNmZXJzLgAAAAAABVRva2VuAAAAAAAAAAAAADJNb25vdG9uaWMgY291bnRlciB1c2VkIHRvIG1pbnQgbmV3IGNvbW1pdG1lbnQgaWRzLgAAAAAABk5leHRJZAAAAAAAAQAAACtBIHNpbmdsZSBjb21taXRtZW50IHJlY29yZCBrZXllZCBieSBpdHMgaWQuAAAAAApDb21taXRtZW50AAAAAAABAAAABgAAAAEAAAArTGlzdCBvZiBjb21taXRtZW50IGlkcyBvd25lZCBieSBhbiBhZGRyZXNzLgAAAAAKT3duZXJJbmRleAAAAAAAAQAAABMAAAAAAAAAF1Byb3RvY29sIGZlZSByZWNpcGllbnQuAAAAAAxGZWVSZWNpcGllbnQAAAAAAAAAPk9uLWNoYWluIHlpZWxkIHBvb2wgYmFsYW5jZSB1c2VkIHRvIHBheSBtYXR1cmVkIHJlbGVhc2UgeWllbGQuAAAAAAAJWWllbGRQb29sAAAAAAAAAAAAAKNTdW0gb2YgYGFjY3J1ZWRfeWllbGRgIHByb21pc2VkIHRvIGZ1bmRlZCBjb21taXRtZW50cyBhbmQgdGhlcmVmb3JlIG5vdAphdmFpbGFibGUgZm9yIHdpdGhkcmF3YWwuIGBZaWVsZFBvb2wgLSBSZXNlcnZlZFlpZWxkYCBpcyB0aGUgc3BlbmRhYmxlCihhdmFpbGFibGUpIGJhbGFuY2UuAAAAAA1SZXNlcnZlZFlpZWxkAAAAAAAAAQAAAL9GbGFnIG1hcmtpbmcgYSBjb21taXRtZW50IHdob3NlIGBhY2NydWVkX3lpZWxkYCB3YXMgcmVzZXJ2ZWQgYWdhaW5zdCB0aGUKcG9vbCBhdCBmdW5kaW5nIHRpbWUuIENvbW1pdG1lbnRzIGZ1bmRlZCBiZWZvcmUgcmVzZXJ2YXRpb24gYWNjb3VudGluZwpleGlzdGVkIGhhdmUgbm8gZmxhZyBhbmQgYXJlIG5ldmVyIHVuLXJlc2VydmVkLgAAAAAIUmVzZXJ2ZWQAAAABAAAABgAAAAAAAABKQ29udHJhY3QgcGF1c2UgZmxhZyB1c2VkIHRvIGhhbHQgd3JpdGUgb3BlcmF0aW9ucyBhbmQgZm9yIGVtZXJnZW5jeSBoYWx0cy4AAAAAAAZQYXVzZWQAAAAAAAEAAAA2SGlzdG9yaWNhbCBhdHRlc3RhdGlvbiByZWNvcmRzIGtleWVkIGJ5IGNvbW1pdG1lbnQgaWQuAAAAAAAMQXR0ZXN0YXRpb25zAAAAAQAAAAYAAAABAAAAOERpc3B1dGUgcmVjb3JkIGZvciBhIGNvbW1pdG1lbnQsIGtleWVkIGJ5IGNvbW1pdG1lbnQgaWQuAAAAB0Rpc3B1dGUAAAAAAQAAAAYAAAABAAAANURlZmF1bHQgcGVuYWx0eSBpbiBiYXNpcyBwb2ludHMgZm9yIGVhY2ggUmlza1Byb2ZpbGUuAAAAAAAADkRlZmF1bHRQZW5hbHR5AAAAAAABAAAH0AAAAAtSaXNrUHJvZmlsZQAAAAAAAAAAQ0NvbmZpZ3VyYWJsZSBwZW5hbHR5LWZyZWUgZ3JhY2UgcGVyaW9kIGJlZm9yZSBtYXR1cml0eSwgaW4gc2Vjb25kcy4AAAAAEkdyYWNlUGVyaW9kU2Vjb25kcwAAAAAAAAAAAEBDb21wbGlhbmNlIHNjb3JlIHRocmVzaG9sZCB0aGF0IGF1dG8tZnJlZXplcyBmdW5kZWQgY29tbWl0bWVudHMuAAAAElZpb2xhdGlvblRocmVzaG9sZAAA",
        "AAAAAQAAACRBIHNpbmdsZSBlc2Nyb3cgLyBjb21taXRtZW50IHJlY29yZC4AAAAAAAAACkNvbW1pdG1lbnQAAAAAAAwAAAAAAAAADWFjY3J1ZWRfeWllbGQAAAAAAAALAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAABWFzc2V0AAAAAAAAEwAAADxDb21wbGlhbmNlIHNjb3JlIDAuLj0xMDAgcmVjb3JkZWQgYnkgdGhlIGF0dGVzdGF0aW9uIGVuZ2luZS4AAAAQY29tcGxpYW5jZV9zY29yZQAAAAQAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAAAmlkAAAAAAAGAAAAQ0xlZGdlciB0aW1lc3RhbXAgKHNlY29uZHMpIGF0IHdoaWNoIHRoZSBjb21taXRtZW50IG1heSBiZSByZWxlYXNlZC4AAAAACG1hdHVyaXR5AAAABgAAAJFBcmJpdHJhcnkga2V5LXZhbHVlIG1ldGFkYXRhIHN1cHBsaWVkIGF0IGNyZWF0aW9uIHRpbWUgKGUuZy4gcmlzayBub3RlcywKb2ZmLWNoYWluIGNvbnRleHQpLiBLZXlzIGFuZCB2YWx1ZXMgYXJlIGJvdGggYFN0cmluZ2AuIEVtcHR5IGJ5IGRlZmF1bHQuAAAAAAAACG1ldGFkYXRhAAAD7AAAABAAAAAQAAAAAAAAAAVvd25lcgAAAAAAABMAAAAzRWFybHktZXhpdCBwZW5hbHR5IGluIGJhc2lzIHBvaW50cyAoZS5nLiAyMDAgPSAyJSkuAAAAAAtwZW5hbHR5X2JwcwAAAAAEAAAAAAAAAARyaXNrAAAH0AAAAAtSaXNrUHJvZmlsZQAAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAxFc2Nyb3dTdGF0dXM=",
        "AAAAAgAAAGBSaXNrIHByb2ZpbGUgY2hvc2VuIGF0IGNyZWF0aW9uIHRpbWUuIERldGVybWluZXMgdGhlIGVhcmx5LWV4aXQgcGVuYWx0eQphcHBsaWVkIGR1cmluZyBgcmVmdW5kYC4AAAAAAAAAC1Jpc2tQcm9maWxlAAAAAAMAAAAAAAAAAAAAAARTYWZlAAAAAAAAAAAAAAAIQmFsYW5jZWQAAAAAAAAAAAAAAApBZ2dyZXNzaXZlAAA=",
        "AAAAAgAAAChMaWZlY3ljbGUgc3RhdHVzIG9mIGEgY29tbWl0bWVudCBlc2Nyb3cuAAAAAAAAAAxFc2Nyb3dTdGF0dXMAAAAHAAAAAAAAABtDcmVhdGVkIGJ1dCBub3QgeWV0IGZ1bmRlZC4AAAAAB0NyZWF0ZWQAAAAAAAAAACNGdW5kZWQgYW5kIGFjdGl2ZWx5IGhlbGQgaW4gZXNjcm93LgAAAAAGRnVuZGVkAAAAAAAAAAAAIk1hdHVyZWQgYW5kIHJlbGVhc2VkIHRvIHRoZSBvd25lci4AAAAAAAhSZWxlYXNlZAAAAAAAAAAlRXhpdGVkIGVhcmx5OyByZWZ1bmRlZCBtaW51cyBwZW5hbHR5LgAAAAAAAAhSZWZ1bmRlZAAAAAAAAAAkVW5kZXIgZGlzcHV0ZTsgdHJhbnNmZXJzIGFyZSBmcm96ZW4uAAAACERpc3B1dGVkAAAAAAAAAFhDb21wbGlhbmNlIHNjb3JlIGRyb3BwZWQgYmVsb3cgdGhlIHZpb2xhdGlvbiB0aHJlc2hvbGQ7IHRyYW5zZmVycyBmcm96ZW4gdW50aWwgcmVzb2x2ZWQuAAAACFZpb2xhdGVkAAAAAAAAADpVbmZ1bmRlZCBjb21taXRtZW50IHdhcyBjYW5jZWxsZWQgYnkgaXRzIG93bmVyIG9yIGV4cGlyZWQuAAAAAAAJQ2FuY2VsbGVkAAAA",
        "AAAAAwAAAHpDYXRlZ29yaXplZCBkaXNwdXRlIHJlYXNvbiBlbnVtLiBFbmFibGVzIGVmZmljaWVudCBvbi1jaGFpbiBjbGFzc2lmaWNhdGlvbgphbmQgb2ZmLWNoYWluIGluZGV4aW5nIG9mIGRpc3B1dGVzIGJ5IGNhdGVnb3J5LgAAAAAAAAAAAA1EaXNwdXRlUmVhc29uAAAAAAAABQAAAEJBY3R1YWwgdmFsdWUgZGVsaXZlcmVkIGRpZCBub3QgbWF0Y2ggdGhlIHByb21pc2VkIG9yIGFncmVlZCB2YWx1ZS4AAAAAAA1WYWx1ZU1pc21hdGNoAAAAAAAAAAAAADVSZXBvcnRlZCBjb21wbGlhbmNlIHZpb2xhdGlvbiBvciBhdHRlc3RhdGlvbiBmYWlsdXJlLgAAAAAAAA1Ob25Db21wbGlhbmNlAAAAAAAAAQAAADVTdXNwZWN0ZWQgZnJhdWR1bGVudCBhY3Rpdml0eSBvciB1bmF1dGhvcml6ZWQgYWNjZXNzLgAAAAAAAA5GcmF1ZFN1c3BpY2lvbgAAAAAAAgAAAChPcGVyYXRpb25hbCBmYWlsdXJlIG9yIGRlbGl2ZXJ5IGZhaWx1cmUuAAAAEk9wZXJhdGlvbmFsRmFpbHVyZQAAAAAAAwAAADJPdGhlciByZWFzb25zIG5vdCBjb3ZlcmVkIGJ5IHRoZSBhYm92ZSBjYXRlZ29yaWVzLgAAAAAABU90aGVyAAAAAAAABA==",
        "AAAAAQAAAHJEaXNwdXRlIHJlY29yZDogc3RvcmVzIGJvdGggdGhlIGNhdGVnb3JpemVkIHJlYXNvbiBhbmQgdGhlIGZyZWUtZm9ybQpyZWFzb24gc3RyaW5nIGZvciBhdWRpdCBhbmQgZGV0YWlsZWQgY29udGV4dC4AAAAAAAAAAAANRGlzcHV0ZVJlY29yZAAAAAAAAAQAAAAmVGltZXN0YW1wIHdoZW4gdGhlIGRpc3B1dGUgd2FzIG9wZW5lZC4AAAAAAAtkaXNwdXRlZF9hdAAAAAAGAAAANEFkZHJlc3MgdGhhdCBpbml0aWF0ZWQgdGhlIGRpc3B1dGUgKG93bmVyIG9yIGFkbWluKS4AAAALZGlzcHV0ZWRfYnkAAAAAEwAAACNDYXRlZ29yaXplZCByZWFzb24gZm9yIHRoZSBkaXNwdXRlLgAAAAAPcmVhc29uX2NhdGVnb3J5AAAAB9AAAAANRGlzcHV0ZVJlYXNvbgAAAAAAADtGcmVlLWZvcm0gcmVhc29uIHN0cmluZyBmb3IgZGV0YWlsZWQgZXhwbGFuYXRpb24gYW5kIGF1ZGl0LgAAAAALcmVhc29uX3RleHQAAAAAEA==",
        "AAAAAQAAACNSZXN1bHQgb2YgYW4gZWFybHkgZXhpdCBjb21taXRtZW50LgAAAAAAAAAAD0Vhcmx5RXhpdFJlc3VsdAAAAAADAAAAAAAAAAtleGl0X2Ftb3VudAAAAAALAAAAAAAAAAxmaW5hbF9zdGF0dXMAAAfQAAAADEVzY3Jvd1N0YXR1cwAAAAAAAAAOcGVuYWx0eV9hbW91bnQAAAAAAAs=",
        "AAAAAQAAAAAAAAAAAAAAD1JlZnVuZEV2ZW50RGF0YQAAAAAFAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAHcGVuYWx0eQAAAAALAAAAAAAAAA9yZWZ1bmRlZF9hbW91bnQAAAAACwAAAAAAAAAEcmlzawAAB9AAAAALUmlza1Byb2ZpbGUA",
        "AAAAAQAAAOtTbmFwc2hvdCBvZiB5aWVsZC1wb29sIHNvbHZlbmN5LgoKYGJhbGFuY2VgIGlzIHRoZSB0b3RhbCBwb29sIGJhbGFuY2UsIGByZXNlcnZlZGAgaXMgdGhlIHBvcnRpb24gYWxyZWFkeQpwcm9taXNlZCB0byBmdW5kZWQgY29tbWl0bWVudHMsIGFuZCBgYXZhaWxhYmxlID0gYmFsYW5jZSAtIHJlc2VydmVkYCBpcyB3aGF0CnRoZSBhZG1pbiBtYXkgd2l0aGRyYXcgb3IgcHJvbWlzZSB0byBuZXcgY29tbWl0bWVudHMuAAAAAAAAAAAPWWllbGRQb29sU3RhdHVzAAAAAAMAAAAAAAAACWF2YWlsYWJsZQAAAAAAAAsAAAAAAAAAB2JhbGFuY2UAAAAACwAAAAAAAAAIcmVzZXJ2ZWQAAAAL",
        "AAAAAQAAAAAAAAAAAAAAEERpc3B1dGVFdmVudERhdGEAAAAGAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAALZGlzcHV0ZWRfYnkAAAAAEwAAAAAAAAAPcmVhc29uX2NhdGVnb3J5AAAAB9AAAAANRGlzcHV0ZVJlYXNvbgAAAAAAAAAAAAALcmVhc29uX3RleHQAAAAAEAAAAAAAAAAEcmlzawAAB9AAAAALUmlza1Byb2ZpbGUA",
        "AAAAAQAAAAAAAAAAAAAAEFJlbGVhc2VFdmVudERhdGEAAAAFAAAAAAAAAA1hY2NydWVkX3lpZWxkAAAAAAAACwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAABnBheW91dAAAAAAACwAAAAAAAAAEcmlzawAAB9AAAAALUmlza1Byb2ZpbGUA",
        "AAAAAQAAAD5SZXN1bHQgb2YgYSBtYXR1cmVkIHNldHRsZW1lbnQgaW52b2tlZCBieSBgc2V0dGxlX2NvbW1pdG1lbnRgLgAAAAAAAAAAABBTZXR0bGVtZW50UmVzdWx0AAAAAgAAAAAAAAAMZmluYWxfc3RhdHVzAAAAEAAAAAAAAAARc2V0dGxlbWVudF9hbW91bnQAAAAAAAAL",
        "AAAAAQAAAD5IaXN0b3JpY2FsIGNvbXBsaWFuY2UgYXR0ZXN0YXRpb24gc3RvcmVkIGFnYWluc3QgYSBjb21taXRtZW50LgAAAAAAAAAAABFBdHRlc3RhdGlvblJlY29yZAAAAAAAAAMAAAAAAAAACGF0dGVzdG9yAAAAEwAAAAAAAAAQY29tcGxpYW5jZV9zY29yZQAAAAQAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAY=",
        "AAAAAQAAAAAAAAAAAAAAE0Z1bmRFc2Nyb3dFdmVudERhdGEAAAAAAwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAABHJpc2sAAAfQAAAAC1Jpc2tQcm9maWxlAA==",
        "AAAAAQAAAAAAAAAAAAAAF1Jlc29sdmVEaXNwdXRlRXZlbnREYXRhAAAAAAYAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAZwYXlvdXQAAAAAAAsAAAAAAAAAB3BlbmFsdHkAAAAACwAAAAAAAAAQcmVsZWFzZV90b19vd25lcgAAAAEAAAAAAAAABHJpc2sAAAfQAAAAC1Jpc2tQcm9maWxlAA==",
        "AAAAAQAAAAAAAAAAAAAAGUNyZWF0ZUNvbW1pdG1lbnRFdmVudERhdGEAAAAAAAAFAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAIbWF0dXJpdHkAAAAGAAAAAAAAAAtwZW5hbHR5X2JwcwAAAAAEAAAAAAAAAARyaXNrAAAH0AAAAAtSaXNrUHJvZmlsZQA=",
        "AAAAAAAAACJQYXVzZSBjb250cmFjdCB3cml0ZXMuIEFkbWluIG9ubHkuAAAAAAAFcGF1c2UAAAAAAAAAAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAEZFYXJseS1leGl0IHJlZnVuZC4gUmV0dXJucyB0aGUgcHJpbmNpcGFsIG1pbnVzIHRoZSBlYXJseS1leGl0IHBlbmFsdHkuAAAAAAAGcmVmdW5kAAAAAAABAAAAAAAAAA1jb21taXRtZW50X2lkAAAAAAAABgAAAAEAAAPpAAAACwAAAAM=",
        "AAAAAAAAAFlGbGFnIGEgZnVuZGVkIGNvbW1pdG1lbnQgYXMgZGlzcHV0ZWQsIGZyZWV6aW5nIHJlbGVhc2UvcmVmdW5kIHVudGlsIGFuCmFkbWluIHJlc29sdmVzIGl0LgAAAAAAAAdkaXNwdXRlAAAAAAMAAAAAAAAADWNvbW1pdG1lbnRfaWQAAAAAAAAGAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABnJlYXNvbgAAAAAAEAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAE1SZWxlYXNlIHRoZSBlc2Nyb3dlZCBmdW5kcyBiYWNrIHRvIHRoZSBvd25lciBvbmNlIHRoZSBjb21taXRtZW50IGhhcyBtYXR1cmVkLgAAAAAAAAdyZWxlYXNlAAAAAAIAAAAAAAAADWNvbW1pdG1lbnRfaWQAAAAAAAAGAAAAAAAAAAZjYWxsZXIAAAAAABMAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAADxSZXN1bWUgY29udHJhY3Qgd3JpdGVzIGFmdGVyIGFuIGVtZXJnZW5jeSBwYXVzZS4gQWRtaW4gb25seS4AAAAHdW5wYXVzZQAAAAAAAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAEVVcGdyYWRlIHRoZSBlc2Nyb3cgY29udHJhY3QgdG8gYSBuZXcgV0FTTSBpbXBsZW1lbnRhdGlvbi4gQWRtaW4gb25seS4AAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAADBSZXR1cm4gd2hldGhlciB0aGUgY29udHJhY3QgaXMgY3VycmVudGx5IHBhdXNlZC4AAAAJaXNfcGF1c2VkAAAAAAAAAAAAAAEAAAAB",
        "AAAAAAAAAOBVcGRhdGUgdGhlIGNvbnRyYWN0IGFkbWluLiBPbmx5IHRoZSBjdXJyZW50IGFkbWluIG1heSBjYWxsIHRoaXMuCgojIEF1dGhvcml6YXRpb24KT25seSBjYWxsYWJsZSBieTogY3VycmVudCBhZG1pbgoKIyBFcnJvcnMKLSBgTm90SW5pdGlhbGl6ZWRgIOKAlCBjb250cmFjdCBub3QgaW5pdGlhbGl6ZWQKLSBgVW5hdXRob3JpemVkYCDigJQgY2FsbGVyIGlzIG5vdCB0aGUgY3VycmVudCBhZG1pbgAAAAlzZXRfYWRtaW4AAAAAAAABAAAAAAAAAAluZXdfYWRtaW4AAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAHpPbmUtdGltZSBpbml0aWFsaXphdGlvbi4gU2V0cyB0aGUgYWRtaW4sIHRoZSBlc2Nyb3cgdG9rZW4sIGZlZSByZWNpcGllbnQsCmFuZCBkZWZhdWx0IHBlbmFsdHkgcmF0ZXMgZm9yIGVhY2ggcmlzayBwcm9maWxlLgAAAAAACmluaXRpYWxpemUAAAAAAAYAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAA1mZWVfcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAYc2FmZV9kZWZhdWx0X3BlbmFsdHlfYnBzAAAABAAAAAAAAAAcYmFsYW5jZWRfZGVmYXVsdF9wZW5hbHR5X2JwcwAAAAQAAAAAAAAAHmFnZ3Jlc3NpdmVfZGVmYXVsdF9wZW5hbHR5X2JwcwAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAFNNb3ZlIHRva2VucyBmcm9tIHRoZSBvd25lciBpbnRvIHRoZSBjb250cmFjdCwgdHJhbnNpdGlvbmluZyBgQ3JlYXRlZGAg4oaSIGBGdW5kZWRgLgAAAAALZnVuZF9lc2Nyb3cAAAAAAQAAAAAAAAANY29tbWl0bWVudF9pZAAAAAAAAAYAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAC1SZXRyaWV2ZSB0aGUgZGlzcHV0ZSByZWNvcmQgZm9yIGEgY29tbWl0bWVudC4AAAAAAAALZ2V0X2Rpc3B1dGUAAAAAAQAAAAAAAAANY29tbWl0bWVudF9pZAAAAAAAAAYAAAABAAAD6AAAB9AAAAANRGlzcHV0ZVJlY29yZAAAAA==",
        "AAAAAAAAACBSZWFkIGEgc2luZ2xlIGNvbW1pdG1lbnQgcmVjb3JkLgAAAA5nZXRfY29tbWl0bWVudAAAAAAAAQAAAAAAAAANY29tbWl0bWVudF9pZAAAAAAAAAYAAAABAAAD6QAAB9AAAAAKQ29tbWl0bWVudAAAAAAAAw==",
        "AAAAAAAAAJFQYXJ0aWFsIGVhcmx5LWV4aXQgcmVmdW5kLiBXaXRoZHJhd3MgYGFtb3VudGAgZnJvbSB0aGUgZXNjcm93ZWQgcHJpbmNpcGFsLAphcHBseWluZyB0aGUgcHJvcG9ydGlvbmFsIGBwZW5hbHR5X2Jwc2AgdG8gdGhlIHdpdGhkcmF3biBwb3J0aW9uIG9ubHkuAAAAAAAADnJlZnVuZF9wYXJ0aWFsAAAAAAACAAAAAAAAAA1jb21taXRtZW50X2lkAAAAAAAABgAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAACNBZG1pbi1vbmx5IHJlc29sdXRpb24gb2YgYSBkaXNwdXRlLgAAAAAPcmVzb2x2ZV9kaXNwdXRlAAAAAAIAAAAAAAAADWNvbW1pdG1lbnRfaWQAAAAAAAAGAAAAAAAAABByZWxlYXNlX3RvX293bmVyAAAAAQAAAAEAAAPpAAAACwAAAAM=",
        "AAAAAAAAADNSZXR1cm4gdGhlIGF0dGVzdGF0aW9uIGhpc3RvcnkgZm9yIGEgY29tbWl0bWVudCBpZC4AAAAAEGdldF9hdHRlc3RhdGlvbnMAAAABAAAAAAAAAA1jb21taXRtZW50X2lkAAAAAAAABgAAAAEAAAPqAAAH0AAAABFBdHRlc3RhdGlvblJlY29yZAAAAA==",
        "AAAAAAAAAEZSZXR1cm5zIHRoZSBjdXJyZW50bHkgY29uZmlndXJlZCBwZW5hbHR5LWZyZWUgZ3JhY2UgcGVyaW9kIGluIHNlY29uZHMuAAAAAAAQZ2V0X2dyYWNlX3BlcmlvZAAAAAAAAAABAAAD6QAAAAYAAAAD",
        "AAAAAAAAAERBZG1pbi1vbmx5IHNldHRlciBmb3IgdGhlIHBlbmFsdHktZnJlZSBncmFjZSBwZXJpb2QgYmVmb3JlIG1hdHVyaXR5LgAAABBzZXRfZ3JhY2VfcGVyaW9kAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAABRncmFjZV9wZXJpb2Rfc2Vjb25kcwAAAAYAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAMFDYW5jZWwgYW4gdW5mdW5kZWQgY29tbWl0bWVudC4gQmVmb3JlIHRoZSBmdW5kaW5nIGRlYWRsaW5lIG9ubHkgaXRzCm93bmVyIG1heSBjYW5jZWwgd2l0aCBhdXRob3JpemF0aW9uOyBhZnRlciBleHBpcnkgY2FuY2VsbGF0aW9uIGlzCnBlcm1pc3Npb25sZXNzLCBpbmNsdWRpbmcgd2hpbGUgY29udHJhY3Qgd3JpdGVzIGFyZSBwYXVzZWQuAAAAAAAAEWNhbmNlbF9jb21taXRtZW50AAAAAAAAAgAAAAAAAAANY29tbWl0bWVudF9pZAAAAAAAAAYAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAElDcmVhdGUgYSBuZXcgKHVuZnVuZGVkKSBjb21taXRtZW50IGVzY3Jvdy4gUmV0dXJucyB0aGUgbmV3IGNvbW1pdG1lbnQgaWQuAAAAAAAAEWNyZWF0ZV9jb21taXRtZW50AAAAAAAABwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAEcmlzawAAB9AAAAALUmlza1Byb2ZpbGUAAAAAAAAAAA1kdXJhdGlvbl9kYXlzAAAAAAAABAAAAAAAAAALcGVuYWx0eV9icHMAAAAABAAAAAAAAAAIbWV0YWRhdGEAAAPsAAAAEAAAABAAAAABAAAD6QAAAAYAAAAD",
        "AAAAAAAAAKJVcGRhdGUgdGhlIGZlZSByZWNpcGllbnQuIE9ubHkgdGhlIGN1cnJlbnQgYWRtaW4gbWF5IGNhbGwgdGhpcy4KCiMgQXV0aG9yaXphdGlvbgpPbmx5IGNhbGxhYmxlIGJ5OiBhZG1pbgoKIyBFcnJvcnMKLSBgTm90SW5pdGlhbGl6ZWRgIOKAlCBjb250cmFjdCBub3QgaW5pdGlhbGl6ZWQAAAAAABFzZXRfZmVlX3JlY2lwaWVudAAAAAAAAAEAAAAAAAAAEW5ld19mZWVfcmVjaXBpZW50AAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAIFBbGlhcyBtYXRjaGluZyB0aGUgYmFja2VuZCBzZXR0bGVtZW50IG1ldGhvZCBuYW1lLiBEZWxlZ2F0ZXMgdG8gbWF0dXJlZApyZWxlYXNlIGxvZ2ljIGFuZCByZXR1cm5zIGEgc3RydWN0dXJlZCBzZXR0bGVtZW50IHJlc3VsdC4AAAAAAAARc2V0dGxlX2NvbW1pdG1lbnQAAAAAAAACAAAAAAAAAA1jb21taXRtZW50X2lkAAAAAAAABgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAA+kAAAfQAAAAEFNldHRsZW1lbnRSZXN1bHQAAAAD",
        "AAAAAAAAAEpEZXBvc2l0IHlpZWxkIHRva2VucyBpbnRvIHRoZSBjb250cmFjdCdzIGRlZGljYXRlZCB5aWVsZCBwb29sLiBBZG1pbiBvbmx5LgAAAAAAEmRlcG9zaXRfeWllbGRfcG9vbAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAD9SZWNvcmQgYSBjb21wbGlhbmNlIGF0dGVzdGF0aW9uICgwLi49MTAwKSBhZ2FpbnN0IGEgY29tbWl0bWVudC4AAAAAEnJlY29yZF9hdHRlc3RhdGlvbgAAAAAAAwAAAAAAAAANY29tbWl0bWVudF9pZAAAAAAAAAYAAAAAAAAACGF0dGVzdG9yAAAAEwAAAAAAAAAQY29tcGxpYW5jZV9zY29yZQAAAAQAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAADVUcmFuc2ZlciBtYXJrZXRwbGFjZSBvd25lcnNoaXAgZm9yIHNlY29uZGFyeSB0cmFkaW5nLgAAAAAAABJ0cmFuc2Zlcl9vd25lcnNoaXAAAAAAAAIAAAAAAAAADWNvbW1pdG1lbnRfaWQAAAAAAAAGAAAAAAAAAAluZXdfb3duZXIAAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAEtSZXRyaWV2ZSB0aGUgZGVmYXVsdCBwZW5hbHR5IChpbiBiYXNpcyBwb2ludHMpIGZvciBhIHNwZWNpZmljIHJpc2sgcHJvZmlsZS4AAAAAE2dldF9kZWZhdWx0X3BlbmFsdHkAAAAAAQAAAAAAAAAEcmlzawAAB9AAAAALUmlza1Byb2ZpbGUAAAAAAQAAA+kAAAAEAAAAAw==",
        "AAAAAAAAAMdXaXRoZHJhdyB1bmFsbG9jYXRlZCB5aWVsZC1wb29sIHN1cnBsdXMgdG8gYHRvYC4gQWRtaW4gb25seS4KCk9ubHkgdGhlIGF2YWlsYWJsZSBwb3J0aW9uIChgYmFsYW5jZSAtIHJlc2VydmVkYCkgbWF5IGJlIHdpdGhkcmF3biwgc28KeWllbGQgYWxyZWFkeSBwcm9taXNlZCB0byBmdW5kZWQgY29tbWl0bWVudHMgY2FuIG5ldmVyIGJlIGRyYWluZWQuAAAAABN3aXRoZHJhd195aWVsZF9wb29sAAAAAAIAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAADRSZXR1cm4gZnVsbCBjb21taXRtZW50IHJlY29yZHMgZm9yIGEgdXNlciAoYm91bmRlZCkuAAAAFGdldF91c2VyX2NvbW1pdG1lbnRzAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAA+oAAAfQAAAACkNvbW1pdG1lbnQAAA==",
        "AAAAAAAAAERQcm9jZXNzIGFuIGVhcmx5IGV4aXQgZm9yIGEgY29tbWl0bWVudC4gUmV0dXJucyBhIHN0cnVjdHVyZWQgcmVzdWx0LgAAABVlYXJseV9leGl0X2NvbW1pdG1lbnQAAAAAAAACAAAAAAAAAA1jb21taXRtZW50X2lkAAAAAAAABgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAA+kAAAfQAAAAD0Vhcmx5RXhpdFJlc3VsdAAAAAAD",
        "AAAAAAAAADxSZXR1cm4gYSBib3VuZGVkIHBhZ2Ugb2YgY29tbWl0bWVudCBpZHMgb3duZWQgYnkgYW4gYWRkcmVzcy4AAAAVZ2V0X293bmVyX2NvbW1pdG1lbnRzAAAAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAVzdGFydAAAAAAAAAQAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPqAAAABg==",
        "AAAAAAAAAIZSZWFkIHRoZSBwb29sIGJhbGFuY2UsIHRoZSByZXNlcnZlZCAocHJvbWlzZWQpIHBvcnRpb24sIGFuZCB0aGUKYXZhaWxhYmxlIHBvcnRpb24gYW4gYWRtaW4gbWF5IHdpdGhkcmF3IG9yIHByb21pc2UgdG8gbmV3IGNvbW1pdG1lbnRzLgAAAAAAFWdldF95aWVsZF9wb29sX3N0YXR1cwAAAAAAAAAAAAABAAAH0AAAAA9ZaWVsZFBvb2xTdGF0dXMA",
        "AAAAAAAAACRSZWFkIHRoZSBjdXJyZW50IHlpZWxkIHBvb2wgYmFsYW5jZS4AAAAWZ2V0X3lpZWxkX3Bvb2xfYmFsYW5jZQAAAAAAAAAAAAEAAAAL",
        "AAAAAAAAAERSZXR1cm4gdGhlIGZpcnN0IGJvdW5kZWQgcGFnZSBvZiBjb21taXRtZW50IGlkcyBvd25lZCBieSBhbiBhZGRyZXNzLgAAABdnZXRfdXNlcl9jb21taXRtZW50X2lkcwAAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAD6gAAAAY=",
        "AAAAAAAAADFSZXR1cm4gdGhlIGN1cnJlbnQgdmlvbGF0aW9uIHRocmVzaG9sZCAoMC4uPTEwMCkuAAAAAAAAF2dldF92aW9sYXRpb25fdGhyZXNob2xkAAAAAAAAAAABAAAABA==",
        "AAAAAAAAAEpTZXQgdGhlIG1pbmltdW0gY29tcGxpYW5jZSBzY29yZSB0aHJlc2hvbGQgZm9yIGF1dG8tdmlvbGF0aW9uLiBBZG1pbiBvbmx5LgAAAAAAF3NldF92aW9sYXRpb25fdGhyZXNob2xkAAAAAAEAAAAAAAAACXRocmVzaG9sZAAAAAAAAAQAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAOBDcmVhdGUgYSBuZXcgKHVuZnVuZGVkKSBjb21taXRtZW50IHVzaW5nIHRoZSBkZWZhdWx0IHBlbmFsdHkgZm9yIHRoZSByaXNrIHByb2ZpbGUuCgpJbmhlcml0cyBgcGVuYWx0eV9icHNgIGZyb20gdGhlIHJpc2sgcHJvZmlsZSBkZWZhdWx0cyBjb25maWd1cmVkIGF0CmluaXRpYWxpemF0aW9uIHRpbWUuIFVzZSBgY3JlYXRlX2NvbW1pdG1lbnQoKWAgZm9yIGFuIGV4cGxpY2l0IG92ZXJyaWRlLgAAABljcmVhdGVfY29tbWl0bWVudF9kZWZhdWx0AAAAAAAABQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAEcmlzawAAB9AAAAALUmlza1Byb2ZpbGUAAAAAAAAAAA1kdXJhdGlvbl9kYXlzAAAAAAAABAAAAAEAAAPpAAAABgAAAAM=",
        "AAAAAAAAAD5SZXR1cm4gYSBwYWdpbmF0ZWQgbGlzdCBvZiBjb21taXRtZW50IGlkcyBvd25lZCBieSBhbiBhZGRyZXNzLgAAAAAAHGdldF91c2VyX2NvbW1pdG1lbnRfaWRzX3BhZ2UAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABXN0YXJ0AAAAAAAABAAAAAAAAAAFbGltaXQAAAAAAAAEAAAAAQAAA+oAAAAG",
        "AAAAAAAAAEtBbGlhcyBmb3IgYGNyZWF0ZV9jb21taXRtZW50X2RlZmF1bHRgLiBQcm92aWRlZCBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eS4AAAAAHmNyZWF0ZV9jb21taXRtZW50X3dpdGhfZGVmYXVsdAAAAAAABQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAEcmlzawAAB9AAAAALUmlza1Byb2ZpbGUAAAAAAAAAAA1kdXJhdGlvbl9kYXlzAAAAAAAABAAAAAEAAAPpAAAABgAAAAM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    pause: this.txFromJSON<Result<void>>,
        refund: this.txFromJSON<Result<i128>>,
        dispute: this.txFromJSON<Result<void>>,
        release: this.txFromJSON<Result<i128>>,
        unpause: this.txFromJSON<Result<void>>,
        upgrade: this.txFromJSON<Result<void>>,
        is_paused: this.txFromJSON<boolean>,
        set_admin: this.txFromJSON<Result<void>>,
        initialize: this.txFromJSON<Result<void>>,
        fund_escrow: this.txFromJSON<Result<void>>,
        get_dispute: this.txFromJSON<Option<DisputeRecord>>,
        get_commitment: this.txFromJSON<Result<Commitment>>,
        refund_partial: this.txFromJSON<Result<i128>>,
        resolve_dispute: this.txFromJSON<Result<i128>>,
        get_attestations: this.txFromJSON<Array<AttestationRecord>>,
        get_grace_period: this.txFromJSON<Result<u64>>,
        set_grace_period: this.txFromJSON<Result<void>>,
        cancel_commitment: this.txFromJSON<Result<void>>,
        create_commitment: this.txFromJSON<Result<u64>>,
        set_fee_recipient: this.txFromJSON<Result<void>>,
        settle_commitment: this.txFromJSON<Result<SettlementResult>>,
        deposit_yield_pool: this.txFromJSON<Result<void>>,
        record_attestation: this.txFromJSON<Result<void>>,
        transfer_ownership: this.txFromJSON<Result<void>>,
        get_default_penalty: this.txFromJSON<Result<u32>>,
        withdraw_yield_pool: this.txFromJSON<Result<void>>,
        get_user_commitments: this.txFromJSON<Array<Commitment>>,
        early_exit_commitment: this.txFromJSON<Result<EarlyExitResult>>,
        get_owner_commitments: this.txFromJSON<Array<u64>>,
        get_yield_pool_status: this.txFromJSON<YieldPoolStatus>,
        get_yield_pool_balance: this.txFromJSON<i128>,
        get_user_commitment_ids: this.txFromJSON<Array<u64>>,
        get_violation_threshold: this.txFromJSON<u32>,
        set_violation_threshold: this.txFromJSON<Result<void>>,
        create_commitment_default: this.txFromJSON<Result<u64>>,
        get_user_commitment_ids_page: this.txFromJSON<Array<u64>>,
        create_commitment_with_default: this.txFromJSON<Result<u64>>
  }
}