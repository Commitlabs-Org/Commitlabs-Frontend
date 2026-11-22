import { Address, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import { invokeContract, simulateRead } from './tx';
import { TxError } from './errors';
import {
  DisputeCategory,
  MAX_DISPUTE_REASON,
  type DisputeRecord,
} from './dispute';

export { DisputeCategory, DISPUTE_CATEGORY_LABELS, MAX_DISPUTE_REASON } from './dispute';
export type { DisputeRecord } from './dispute';

export interface OpenDisputeParams {
  commitmentId: string;
  caller: string;
  reason: string;
}

export interface OpenDisputeResult {
  transactionHash: string;
}

export interface EarlyExitParams {
  commitmentId: string;
  caller: string;
}

export interface EarlyExitResult {
  transactionHash: string;
  exitAmount: bigint;
  penaltyAmount: bigint;
  finalStatus: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toCommitmentId(commitmentId: string): number | null {
  const id = Number(commitmentId);
  if (!Number.isFinite(id) || !Number.isInteger(id) || id < 0 || id > Number.MAX_SAFE_INTEGER) {
    return null;
  }
  return id;
}

function pick(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key];
  }
  return undefined;
}

function toDisputeDate(value: unknown): Date {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date(0);
}

function decodePositional(parts: unknown[]): DisputeRecord {
  const [reasonCategory, reasonText, disputedAt, disputedBy] = parts;
  return {
    reasonCategory: normalizeCategory(reasonCategory),
    reasonText: String(reasonText ?? ''),
    disputedAt: toDisputeDate(disputedAt),
    disputedBy: String(disputedBy ?? ''),
  };
}

/**
 * Decodes a `get_dispute` return value. On-chain the contract returns
 * `Option<DisputeRecord>`: `scValToNative` renders `Option` as a vec (`[]` for
 * `None`, `[record]` for `Some`) and the `#[contracttype]` struct as a map keyed
 * by its Rust field names. Positional and `{ some }` / `{ none }` shapes are
 * tolerated too so the decoder is resilient to SDK/encoder differences.
 */
function decodeDisputeRecord(value: unknown): DisputeRecord | null {
  let current: unknown = value;

  if (Array.isArray(current)) {
    if (current.length === 0) return null;
    if (current.length === 1) current = current[0];
    else if (current.length >= 4) return decodePositional(current);
    else return null;
  }

  if (isPlainObject(current)) {
    if ('none' in current) return null;
    if ('some' in current) current = current.some;
  }

  if (Array.isArray(current)) {
    if (current.length === 0) return null;
    if (current.length === 1) current = current[0];
    else if (current.length >= 4) return decodePositional(current);
    else return null;
  }

  if (!isPlainObject(current)) return null;

  const reasonCategory = pick(current, 'reasonCategory', 'reason_category');
  if (reasonCategory === undefined) return null;

  return {
    reasonCategory: normalizeCategory(reasonCategory),
    reasonText: String(pick(current, 'reasonText', 'reason_text') ?? ''),
    disputedAt: toDisputeDate(pick(current, 'disputedAt', 'disputed_at')),
    disputedBy: String(pick(current, 'disputedBy', 'disputed_by') ?? ''),
  };
}

function normalizeCategory(value: unknown): DisputeCategory {
  const category = Number(value);
  return Number.isInteger(category) && category >= 0 && category <= DisputeCategory.Other
    ? (category as DisputeCategory)
    : DisputeCategory.Other;
}

/** Flag a funded commitment as disputed, freezing release and refund until the
 * operator resolves it. Submits `dispute(commitment_id, caller, reason)` via
 * Freighter. The reason is client-side bounded because the contract accepts an
 * unbounded string. */
export async function openDispute({ commitmentId, caller, reason }: OpenDisputeParams): Promise<OpenDisputeResult> {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) {
    throw new TxError('failed', 'Please describe the problem you want to report.');
  }
  if (trimmed.length > MAX_DISPUTE_REASON) {
    throw new TxError('failed', `The reason must be ${MAX_DISPUTE_REASON} characters or less.`);
  }

  const id = toCommitmentId(commitmentId);
  if (id === null) {
    throw new TxError('failed', 'This commitment is not on-chain and cannot be disputed.', {
      hint: 'Fund the commitment on-chain first, then report the problem.',
    });
  }

  return invokeContract({
    method: 'dispute',
    args: [nativeToScVal(BigInt(id)), nativeToScVal(Address.fromString(caller)), nativeToScVal(trimmed)],
    source: caller,
    signer: caller,
  });
}

/** Read the dispute record for a commitment, if one exists. Returns null when
 * there is no dispute or the commitment id cannot be resolved on-chain. */
export async function getDispute(commitmentId: string, source?: string): Promise<DisputeRecord | null> {
  const id = toCommitmentId(commitmentId);
  if (id === null) return null;

  const result = await simulateRead({ method: 'get_dispute', args: [nativeToScVal(BigInt(id))], source });
  if (result.error || result.result == null) return null;

  return decodeDisputeRecord(scValToNative(result.result as unknown as xdr.ScVal));
}

function toBigIntAmount(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return null;
}

function normalizeFinalStatus(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? 'exited');
  }
  if (value === undefined || value === null) return 'exited';
  return String(value);
}

/**
 * Decodes an `EarlyExitResult` returned by `early_exit_commitment`:
 * `{ exit_amount, penalty_amount, final_status }`.
 */
export function decodeEarlyExitResult(
  value: unknown,
): Omit<EarlyExitResult, 'transactionHash'> | null {
  if (Array.isArray(value)) {
    if (value.length < 2) return null;
    const exitAmount = toBigIntAmount(value[0]);
    const penaltyAmount = toBigIntAmount(value[1]);
    if (exitAmount === null || penaltyAmount === null) return null;
    return {
      exitAmount,
      penaltyAmount,
      finalStatus: normalizeFinalStatus(value[2]),
    };
  }

  if (!isPlainObject(value)) return null;

  const exitAmount = toBigIntAmount(pick(value, 'exit_amount', 'exitAmount'));
  const penaltyAmount = toBigIntAmount(pick(value, 'penalty_amount', 'penaltyAmount'));
  if (exitAmount === null || penaltyAmount === null) return null;

  return {
    exitAmount,
    penaltyAmount,
    finalStatus: normalizeFinalStatus(pick(value, 'final_status', 'finalStatus')),
  };
}

/**
 * Exit an active on-chain commitment early via `early_exit_commitment(commitment_id, caller)`.
 * Returns the exact `exitAmount`, `penaltyAmount`, and `finalStatus` decoded from the
 * contract's `EarlyExitResult`.
 */
export async function earlyExitCommitment({
  commitmentId,
  caller,
}: EarlyExitParams): Promise<EarlyExitResult> {
  const id = toCommitmentId(commitmentId);
  if (id === null) {
    throw new TxError('failed', 'This commitment is not on-chain and cannot be exited on-chain.', {
      hint: 'Only on-chain commitments with a numeric id can be exited via the contract.',
    });
  }

  const res = await invokeContract({
    method: 'early_exit_commitment',
    args: [nativeToScVal(BigInt(id)), nativeToScVal(Address.fromString(caller))],
    source: caller,
    signer: caller,
  });

  if (!res.returnValue) {
    throw new TxError(
      'failed',
      'Early exit transaction succeeded, but the contract did not return an EarlyExitResult.',
      { transactionHash: res.transactionHash },
    );
  }

  const decoded = decodeEarlyExitResult(scValToNative(res.returnValue));
  if (!decoded) {
    throw new TxError(
      'failed',
      'Early exit transaction succeeded, but the contract result could not be decoded.',
      { transactionHash: res.transactionHash },
    );
  }

  return {
    transactionHash: res.transactionHash,
    ...decoded,
  };
}
