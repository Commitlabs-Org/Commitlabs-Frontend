import { rpc, scValToBigInt, scValToNative, xdr } from '@stellar/stellar-sdk';
import { getActiveConfig } from '../config';
import { simulateRead } from './tx';

import type { ProtocolStatus, YieldPoolStatus } from './protocol-policy';

export * from './protocol-policy';

export function decodeBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (val && typeof val === 'object') {
    if ('result' in val && (val as any).result?.retval) {
      return decodeBool((val as any).result.retval);
    }
    if (val instanceof xdr.ScVal || ('switch' in val && typeof (val as any).switch === 'function')) {
      const native = scValToNative(val as xdr.ScVal);
      if (typeof native === 'boolean') return native;
    }
  }
  if (typeof val === 'string') {
    try {
      const parsed = xdr.ScVal.fromXDR(val, 'base64');
      const native = scValToNative(parsed);
      if (typeof native === 'boolean') return native;
    } catch {
      // not base64 xdr
    }
  }
  return Boolean(val);
}

export function decodeI128(val: unknown): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') return BigInt(val);
  if (val && typeof val === 'object') {
    if ('result' in val && (val as any).result?.retval) {
      return decodeI128((val as any).result.retval);
    }
    if (val instanceof xdr.ScVal || ('switch' in val && typeof (val as any).switch === 'function')) {
      try {
        return scValToBigInt(val as xdr.ScVal);
      } catch {
        const native = scValToNative(val as xdr.ScVal);
        return BigInt(native);
      }
    }
  }
  if (typeof val === 'string') {
    try {
      const parsed = xdr.ScVal.fromXDR(val, 'base64');
      return scValToBigInt(parsed);
    } catch {
      return BigInt(val);
    }
  }
  throw new Error(`Unable to decode value into i128 / bigint: ${val}`);
}

/** Unwraps a simulation result (ScVal, base64 XDR or `{ result: { retval } }`) to a native value. */
function unwrapScVal(val: unknown): unknown {
  if (val && typeof val === 'object') {
    if ('result' in val && (val as any).result?.retval !== undefined) {
      return unwrapScVal((val as any).result.retval);
    }
    if (val instanceof xdr.ScVal || ('switch' in val && typeof (val as any).switch === 'function')) {
      return scValToNative(val as xdr.ScVal);
    }
  }
  if (typeof val === 'string') {
    try {
      return scValToNative(xdr.ScVal.fromXDR(val, 'base64'));
    } catch {
      // not base64 xdr
    }
  }
  return val;
}

/** Decodes the `YieldPoolStatus` struct returned by `get_yield_pool_status`. */
export function decodeYieldPoolStatus(val: unknown): YieldPoolStatus {
  const native = unwrapScVal(val) as Record<string, unknown> | null | undefined;
  if (!native || typeof native !== 'object') {
    throw new Error('Unable to decode yield pool status');
  }
  return {
    balance: decodeI128(native.balance),
    reserved: decodeI128(native.reserved),
    available: decodeI128(native.available),
  };
}

/** Runs a read-only simulation and returns the raw return value, throwing on failure. */
async function readValue(method: string): Promise<unknown> {
  const res = await simulateRead({ method, args: [] });
  if (res.error) throw new Error(res.error);
  return res.result;
}

export interface GetProtocolStatusOptions {
  contractId?: string;
  rpcUrl?: string;
  server?: rpc.Server;
}

/**
 * Reads escrow pause state and yield-pool balance via read-only simulation.
 * Never throws on RPC or contract errors; returns an 'unavailable' status instead.
 */
export async function getProtocolStatus(
  options: GetProtocolStatusOptions = {},
): Promise<ProtocolStatus> {
  const contractId = options.contractId || getActiveConfig().escrowContractId;
  if (!contractId) {
    return {
      status: 'unavailable',
      paused: false,
      yieldPool: 0n,
      fetchedAt: Date.now(),
      error: 'Escrow contract ID is not configured',
    };
  }

  try {
    const [pausedScVal, yieldPoolScVal] = await Promise.all([
      readValue('is_paused'),
      readValue('get_yield_pool_balance'),
    ]);

    const paused = decodeBool(pausedScVal);
    const yieldPool = decodeI128(yieldPoolScVal);

    return {
      status: 'ok',
      paused,
      yieldPool,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    return {
      status: 'unavailable',
      paused: false,
      yieldPool: 0n,
      fetchedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Reads the escrow yield pool's total balance, reserved (promised) amount and
 * available amount via `get_yield_pool_status` (contracts/escrow/src/lib.rs).
 *
 * Unlike `getProtocolStatus`, this throws on RPC or contract errors so callers
 * can show an error state instead of a misleading zero balance.
 */
export async function getYieldPoolStatus(
  options: GetProtocolStatusOptions = {},
): Promise<YieldPoolStatus> {
  const contractId = options.contractId || config.escrowContractId;
  if (!contractId) {
    throw new Error('Escrow contract ID is not configured');
  }
  const raw = await readValue('get_yield_pool_status');
  return decodeYieldPoolStatus(raw);
}
