import { rpc, scValToBigInt, scValToNative, xdr } from '@stellar/stellar-sdk';
import { config } from '../config';
import { simulateRead } from './tx';

export interface ProtocolStatus {
  status: 'ok' | 'unavailable';
  paused: boolean;
  yieldPool: bigint;
  fetchedAt: number;
  error?: string;
}

export type EscrowAction =
  | 'create_commitment'
  | 'create_commitment_default'
  | 'fund_escrow'
  | 'refund'
  | 'refund_partial'
  | 'early_exit'
  | 'release'
  | 'settle';

export interface ActionPolicy {
  action: EscrowAction;
  pausedBlocked: boolean;
  pausedReason?: string;
  contractDoc: string;
}

/**
 * Escrow pause policy table documenting contract entrypoint behavior.
 * Mirrors contracts/escrow/src/lib.rs:
 * - create_commitment: L433 (checks is_paused_internal -> Error::Paused)
 * - create_commitment_default: L501 (checks is_paused_internal -> Error::Paused)
 * - fund_escrow: L571 (checks is_paused_internal -> Error::Paused)
 * - refund: L712 (checks is_paused_internal -> Error::Paused)
 * - refund_partial: L723 (checks is_paused_internal -> Error::Paused)
 * - early_exit: applies refund under the hood (checks is_paused_internal -> Error::Paused)
 * - release: does NOT check pause on-chain (remains active for mature payouts)
 * - settle: does NOT check pause on-chain (remains active for mature payouts)
 */
export const ACTION_POLICIES: Record<EscrowAction, ActionPolicy> = {
  create_commitment: {
    action: 'create_commitment',
    pausedBlocked: true,
    pausedReason: 'Commitment creation is temporarily paused by the contract operator.',
    contractDoc: 'contracts/escrow/src/lib.rs: create_commitment checks is_paused_internal',
  },
  create_commitment_default: {
    action: 'create_commitment_default',
    pausedBlocked: true,
    pausedReason: 'Commitment creation is temporarily paused by the contract operator.',
    contractDoc: 'contracts/escrow/src/lib.rs: create_commitment_default checks is_paused_internal',
  },
  fund_escrow: {
    action: 'fund_escrow',
    pausedBlocked: true,
    pausedReason: 'Escrow funding is temporarily paused by the contract operator.',
    contractDoc: 'contracts/escrow/src/lib.rs: fund_escrow checks is_paused_internal',
  },
  refund: {
    action: 'refund',
    pausedBlocked: true,
    pausedReason: 'Refunds are temporarily paused by the contract operator.',
    contractDoc: 'contracts/escrow/src/lib.rs: refund checks is_paused_internal',
  },
  refund_partial: {
    action: 'refund_partial',
    pausedBlocked: true,
    pausedReason: 'Partial refunds are temporarily paused by the contract operator.',
    contractDoc: 'contracts/escrow/src/lib.rs: refund_partial checks is_paused_internal',
  },
  early_exit: {
    action: 'early_exit',
    pausedBlocked: true,
    pausedReason: 'Early exits are temporarily disabled while the contract is paused.',
    contractDoc: 'contracts/escrow/src/lib.rs: early_exit / refund checks is_paused_internal',
  },
  release: {
    action: 'release',
    pausedBlocked: false,
    contractDoc: 'contracts/escrow/src/lib.rs: release does not check pause',
  },
  settle: {
    action: 'settle',
    pausedBlocked: false,
    contractDoc: 'contracts/escrow/src/lib.rs: settle_commitment / release does not check pause',
  },
};

export function isActionBlocked(action: EscrowAction, paused: boolean): boolean {
  if (!paused) return false;
  return Boolean(ACTION_POLICIES[action]?.pausedBlocked);
}

export function getActionPauseReason(action: EscrowAction, paused: boolean): string | undefined {
  if (!paused) return undefined;
  return ACTION_POLICIES[action]?.pausedBlocked ? ACTION_POLICIES[action]?.pausedReason : undefined;
}

export const COVERAGE_WARNING_MESSAGE =
  'Yield pool currently cannot cover this payout; settlement will fail until it is topped up.';

export function isPayoutUncovered(
  accruedYield: bigint | number,
  yieldPool: bigint | number,
): boolean {
  return BigInt(accruedYield) > BigInt(yieldPool);
}

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
  const contractId = options.contractId || config.escrowContractId;
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
      simulateRead('is_paused', [], options),
      simulateRead('get_yield_pool_balance', [], options),
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
