import { Address, nativeToScVal, scValToNative, StrKey, xdr } from '@stellar/stellar-sdk';
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

export interface PendingTransferRecord {
  to: string;
  expiresAt: Date;
  rawExpiresAt: bigint;
}

export interface ProposeTransferParams {
  commitmentId: string;
  caller: string;
  newOwner: string;
}

export interface AcceptTransferParams {
  commitmentId: string;
  caller: string;
}

export interface CancelTransferParams {
  commitmentId: string;
  caller: string;
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

function toTimestampSeconds(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.floor(value));
  if (typeof value === 'string') {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function toExpiresDate(value: unknown): Date {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date(0);
}

/**
 * Decodes a `get_pending_owner` return value. On-chain the contract returns
 * `Option<PendingTransfer>`: `scValToNative` renders `Option` as a vec (`[]` for
 * `None`, `[record]` for `Some`) and the `#[contracttype]` struct as a map keyed
 * by its Rust field names (`to`, `expires_at`). Positional and `{ some }` / `{ none }`
 * shapes are also tolerated.
 */
export function decodePendingTransfer(value: unknown): PendingTransferRecord | null {
  if (value == null) return null;
  let current: unknown = value;

  if (Array.isArray(current)) {
    if (current.length === 0) return null;
    if (current.length === 1) current = current[0];
    else if (current.length >= 2) {
      const [to, expiresAt] = current;
      if (!to || expiresAt === undefined) return null;
      return {
        to: String(to),
        expiresAt: toExpiresDate(expiresAt),
        rawExpiresAt: toTimestampSeconds(expiresAt),
      };
    } else {
      return null;
    }
  }

  if (isPlainObject(current)) {
    if ('none' in current) return null;
    if ('some' in current) current = current.some;
  }

  if (Array.isArray(current)) {
    if (current.length === 0) return null;
    if (current.length === 1) current = current[0];
    else if (current.length >= 2) {
      const [to, expiresAt] = current;
      if (!to || expiresAt === undefined) return null;
      return {
        to: String(to),
        expiresAt: toExpiresDate(expiresAt),
        rawExpiresAt: toTimestampSeconds(expiresAt),
      };
    } else {
      return null;
    }
  }

  if (!isPlainObject(current)) return null;

  const to = pick(current, 'to');
  const expiresAt = pick(current, 'expiresAt', 'expires_at');
  if (to === undefined || expiresAt === undefined) return null;

  return {
    to: String(to),
    expiresAt: toExpiresDate(expiresAt),
    rawExpiresAt: toTimestampSeconds(expiresAt),
  };
}

/** Read the pending ownership transfer for a commitment, if one exists. Returns null
 * when there is no pending transfer or the commitment id is invalid. */
export async function getPendingOwner(
  commitmentId: string,
  source?: string,
): Promise<PendingTransferRecord | null> {
  const id = toCommitmentId(commitmentId);
  if (id === null) return null;

  const result = await simulateRead({
    method: 'get_pending_owner',
    args: [nativeToScVal(BigInt(id))],
    source,
  });
  if (result.error || result.result == null) return null;

  return decodePendingTransfer(scValToNative(result.result as unknown as xdr.ScVal));
}

/** Propose transferring ownership of a funded commitment to a new Stellar account.
 * Address is validated client-side with `StrKey.isValidEd25519PublicKey`. */
export async function proposeTransfer({
  commitmentId,
  caller,
  newOwner,
}: ProposeTransferParams): Promise<OpenDisputeResult> {
  const trimmed = (newOwner ?? '').trim();
  if (!trimmed || !StrKey.isValidEd25519PublicKey(trimmed)) {
    throw new TxError('failed', 'Invalid Stellar address. Must be a valid G-address.', {
      hint: 'Enter a valid 56-character Stellar public key (starting with G).',
    });
  }

  const id = toCommitmentId(commitmentId);
  if (id === null) {
    throw new TxError('failed', 'This commitment is not on-chain and cannot be transferred.', {
      hint: 'Fund the commitment on-chain first, then initiate a transfer.',
    });
  }

  return invokeContract({
    method: 'transfer_ownership',
    args: [nativeToScVal(BigInt(id)), nativeToScVal(Address.fromString(trimmed))],
    source: caller,
    signer: caller,
  });
}

/** Accept a pending ownership transfer offer. Must be called by the proposed new owner. */
export async function acceptTransfer({
  commitmentId,
  caller,
}: AcceptTransferParams): Promise<OpenDisputeResult> {
  const id = toCommitmentId(commitmentId);
  if (id === null) {
    throw new TxError('failed', 'This commitment is not on-chain.');
  }

  return invokeContract({
    method: 'accept_ownership',
    args: [nativeToScVal(BigInt(id))],
    source: caller,
    signer: caller,
  });
}

/** Cancel a pending ownership transfer offer. Must be called by the current commitment owner. */
export async function cancelTransfer({
  commitmentId,
  caller,
}: CancelTransferParams): Promise<OpenDisputeResult> {
  const id = toCommitmentId(commitmentId);
  if (id === null) {
    throw new TxError('failed', 'This commitment is not on-chain.');
  }

  return invokeContract({
    method: 'cancel_ownership_transfer',
    args: [nativeToScVal(BigInt(id))],
    source: caller,
    signer: caller,
  });
}
