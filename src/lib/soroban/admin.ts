import { Address, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import { invokeContract, simulateRead, type InvokeResult } from './tx';
import { decodeBool } from './protocol-status';

export const SECONDS_PER_DAY = 86_400n;
export const MAX_DURATION_DAYS = 365n;
export const MAX_LOCK_DURATION_SECONDS = MAX_DURATION_DAYS * SECONDS_PER_DAY; // 31,536,000s

export interface ValidationResult<T = unknown> {
  valid: boolean;
  error?: string;
  value?: T;
}

/**
 * Validates a grace period (in seconds) against contract bounds.
 * Bound: 0 <= grace_period_seconds <= 365 * 86_400 (InvalidGracePeriod)
 */
export function validateGracePeriod(input: string | number | bigint): ValidationResult<bigint> {
  const str = String(input ?? '').trim();
  if (!str) {
    return { valid: false, error: 'Grace period cannot be empty.' };
  }
  if (!/^\d+$/.test(str)) {
    return {
      valid: false,
      error: 'Grace period must be a non-negative integer representing seconds.',
    };
  }
  try {
    const val = BigInt(str);
    if (val < 0n) {
      return { valid: false, error: 'Grace period must be non-negative.' };
    }
    if (val > MAX_LOCK_DURATION_SECONDS) {
      return {
        valid: false,
        error: `Grace period exceeds maximum lock duration of 365 days (${MAX_LOCK_DURATION_SECONDS.toString()} seconds).`,
      };
    }
    return { valid: true, value: val };
  } catch {
    return { valid: false, error: 'Could not parse grace period as an integer.' };
  }
}

/**
 * Validates a violation threshold against contract bounds (0..=100).
 * Threshold 101 rejected, 0 and 100 accepted.
 */
export function validateViolationThreshold(input: string | number): ValidationResult<number> {
  const str = String(input ?? '').trim();
  if (!str) {
    return { valid: false, error: 'Violation threshold cannot be empty.' };
  }
  if (!/^\d+$/.test(str)) {
    return {
      valid: false,
      error: 'Violation threshold must be a non-negative integer between 0 and 100.',
    };
  }
  const val = Number(str);
  if (!Number.isInteger(val) || val < 0 || val > 100) {
    return {
      valid: false,
      error: 'Violation threshold must be between 0 and 100.',
    };
  }
  return { valid: true, value: val };
}

/**
 * Validates that an address string is a valid Stellar account or contract address.
 */
export function validateAddress(address: string, label = 'Address'): ValidationResult<string> {
  const trimmed = (address ?? '').trim();
  if (!trimmed) {
    return { valid: false, error: `${label} cannot be empty.` };
  }
  try {
    Address.fromString(trimmed);
    return { valid: true, value: trimmed };
  } catch {
    return {
      valid: false,
      error: `Invalid ${label}. Must be a valid Stellar public key (G...) or contract address (C...).`,
    };
  }
}

export function decodeAddress(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let val: unknown = raw;
  if (val && typeof val === 'object' && 'result' in (val as any) && (val as any).result?.retval) {
    val = (val as any).result.retval;
  }
  if (val instanceof xdr.ScVal || (val && typeof val === 'object' && 'switch' in (val as any))) {
    try {
      val = scValToNative(val as xdr.ScVal);
    } catch {
      return null;
    }
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return null;
    val = val[0];
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    return val.trim();
  }
  if (val && typeof val === 'object') {
    if ('some' in (val as any)) return decodeAddress((val as any).some);
    if ('address' in (val as any)) return String((val as any).address);
  }
  return null;
}

export function decodeOptionAddress(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let val: unknown = raw;
  if (val && typeof val === 'object' && 'result' in (val as any) && (val as any).result?.retval) {
    val = (val as any).result.retval;
  }
  if (val instanceof xdr.ScVal || (val && typeof val === 'object' && 'switch' in (val as any))) {
    try {
      val = scValToNative(val as xdr.ScVal);
    } catch {
      return null;
    }
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return null;
    return decodeAddress(val[0]);
  }
  if (val && typeof val === 'object') {
    if ('none' in (val as any)) return null;
    if ('some' in (val as any)) return decodeAddress((val as any).some);
  }
  return decodeAddress(val);
}

export function decodeU64(raw: unknown): bigint {
  if (typeof raw === 'bigint') return raw;
  if (typeof raw === 'number') return BigInt(raw);
  if (typeof raw === 'string') {
    try {
      const parsed = xdr.ScVal.fromXDR(raw, 'base64');
      return decodeU64(parsed);
    } catch {
      return BigInt(raw);
    }
  }
  if (raw && typeof raw === 'object') {
    if ('result' in raw && (raw as any).result?.retval) {
      return decodeU64((raw as any).result.retval);
    }
    if (raw instanceof xdr.ScVal || ('switch' in (raw as any) && typeof (raw as any).switch === 'function')) {
      const native = scValToNative(raw as xdr.ScVal);
      if (typeof native === 'bigint') return native;
      if (typeof native === 'number') return BigInt(native);
      if (Array.isArray(native) && native.length > 0) return decodeU64(native[0]);
    }
  }
  throw new Error(`Unable to decode value into u64 / bigint: ${raw}`);
}

export function decodeU32(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'bigint') return Number(raw);
  if (typeof raw === 'string') {
    try {
      const parsed = xdr.ScVal.fromXDR(raw, 'base64');
      return decodeU32(parsed);
    } catch {
      return Number(raw);
    }
  }
  if (raw && typeof raw === 'object') {
    if ('result' in raw && (raw as any).result?.retval) {
      return decodeU32((raw as any).result.retval);
    }
    if (raw instanceof xdr.ScVal || ('switch' in (raw as any) && typeof (raw as any).switch === 'function')) {
      const native = scValToNative(raw as xdr.ScVal);
      if (typeof native === 'number') return native;
      if (typeof native === 'bigint') return Number(native);
      if (Array.isArray(native) && native.length > 0) return decodeU32(native[0]);
    }
  }
  throw new Error(`Unable to decode value into u32: ${raw}`);
}

// ── Read operations ─────────────────────────────────────────────────────────

export async function getAdmin(): Promise<string | null> {
  const res = await simulateRead({ method: 'get_admin', args: [] });
  if (res.error || !res.result) return null;
  return decodeAddress(res.result);
}

export async function getPendingAdmin(): Promise<string | null> {
  const res = await simulateRead({ method: 'get_pending_admin', args: [] });
  if (res.error) return null;
  return decodeOptionAddress(res.result);
}

export async function getGracePeriod(): Promise<bigint | null> {
  const res = await simulateRead({ method: 'get_grace_period', args: [] });
  if (res.error || res.result === undefined || res.result === null) return null;
  try {
    return decodeU64(res.result);
  } catch {
    return null;
  }
}

export async function getViolationThreshold(): Promise<number | null> {
  const res = await simulateRead({ method: 'get_violation_threshold', args: [] });
  if (res.error || res.result === undefined || res.result === null) return null;
  try {
    return decodeU32(res.result);
  } catch {
    return null;
  }
}

export async function getIsPaused(): Promise<boolean | null> {
  const res = await simulateRead({ method: 'is_paused', args: [] });
  if (res.error || res.result === undefined || res.result === null) return null;
  try {
    return decodeBool(res.result);
  } catch {
    return null;
  }
}

// ── Write operations ────────────────────────────────────────────────────────

export async function pause(caller: string): Promise<InvokeResult> {
  return invokeContract({
    method: 'pause',
    args: [],
    source: caller,
    signer: caller,
  });
}

export async function unpause(caller: string): Promise<InvokeResult> {
  return invokeContract({
    method: 'unpause',
    args: [],
    source: caller,
    signer: caller,
  });
}

export async function setFeeRecipient(params: {
  newFeeRecipient: string;
  caller: string;
}): Promise<InvokeResult> {
  const valid = validateAddress(params.newFeeRecipient, 'Fee recipient');
  if (!valid.valid || !valid.value) {
    throw new Error(valid.error ?? 'Invalid fee recipient address.');
  }
  return invokeContract({
    method: 'set_fee_recipient',
    args: [new Address(valid.value).toScVal()],
    source: params.caller,
    signer: params.caller,
  });
}

export async function setGracePeriod(params: {
  gracePeriodSeconds: bigint | number | string;
  caller: string;
}): Promise<InvokeResult> {
  const valid = validateGracePeriod(params.gracePeriodSeconds);
  if (!valid.valid || valid.value === undefined) {
    throw new Error(valid.error ?? 'Invalid grace period.');
  }
  return invokeContract({
    method: 'set_grace_period',
    args: [nativeToScVal(valid.value, { type: 'u64' })],
    source: params.caller,
    signer: params.caller,
  });
}

export async function setViolationThreshold(params: {
  threshold: number | string;
  caller: string;
}): Promise<InvokeResult> {
  const valid = validateViolationThreshold(params.threshold);
  if (!valid.valid || valid.value === undefined) {
    throw new Error(valid.error ?? 'Invalid violation threshold.');
  }
  return invokeContract({
    method: 'set_violation_threshold',
    args: [nativeToScVal(valid.value, { type: 'u32' })],
    source: params.caller,
    signer: params.caller,
  });
}

export async function proposeAdmin(params: {
  newAdmin: string;
  caller: string;
}): Promise<InvokeResult> {
  const valid = validateAddress(params.newAdmin, 'New admin');
  if (!valid.valid || !valid.value) {
    throw new Error(valid.error ?? 'Invalid new admin address.');
  }
  return invokeContract({
    method: 'propose_admin',
    args: [new Address(valid.value).toScVal()],
    source: params.caller,
    signer: params.caller,
  });
}

export async function acceptAdmin(caller: string): Promise<InvokeResult> {
  return invokeContract({
    method: 'accept_admin',
    args: [],
    source: caller,
    signer: caller,
  });
}

export async function cancelAdminProposal(caller: string): Promise<InvokeResult> {
  return invokeContract({
    method: 'cancel_admin_proposal',
    args: [],
    source: caller,
    signer: caller,
  });
}
