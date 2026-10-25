/**
 * Escrow pause policy and protocol-status types. Kept free of
 * `@stellar/stellar-sdk` so pages can import it without pulling the SDK into
 * their first-load bundle; the RPC reads live in `./protocol-status`.
 */

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
