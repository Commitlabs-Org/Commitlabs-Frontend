import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nativeToScVal } from '@stellar/stellar-sdk';
import {
  decodeBool,
  decodeI128,
  getProtocolStatus,
  ACTION_POLICIES,
  isActionBlocked,
  getActionPauseReason,
  COVERAGE_WARNING_MESSAGE,
  isPayoutUncovered,
  type EscrowAction,
} from '../protocol-status';
import * as txModule from '../tx';

describe('protocol-status decoders and reads', () => {
  it('decodes bool simulation results', () => {
    const trueScVal = nativeToScVal(true);
    const falseScVal = nativeToScVal(false);

    expect(decodeBool(trueScVal)).toBe(true);
    expect(decodeBool(falseScVal)).toBe(false);
    expect(decodeBool(true)).toBe(true);
    expect(decodeBool(false)).toBe(false);
    expect(decodeBool({ result: { retval: trueScVal } })).toBe(true);
    expect(decodeBool({ result: { retval: falseScVal } })).toBe(false);
  });

  it('decodes i128 simulation results', () => {
    const zeroScVal = nativeToScVal(0n, { type: 'i128' });
    const amountScVal = nativeToScVal(50000000n, { type: 'i128' });
    const largeScVal = nativeToScVal(12345678901234567890n, { type: 'i128' });

    expect(decodeI128(zeroScVal)).toBe(0n);
    expect(decodeI128(amountScVal)).toBe(50000000n);
    expect(decodeI128(largeScVal)).toBe(12345678901234567890n);
    expect(decodeI128(100n)).toBe(100n);
    expect(decodeI128(100)).toBe(100n);
    expect(decodeI128({ result: { retval: amountScVal } })).toBe(50000000n);
  });

  it('reads protocol status when simulations succeed', async () => {
    const spy = vi.spyOn(txModule, 'simulateRead').mockImplementation(async (method) => {
      if (method === 'is_paused') {
        return nativeToScVal(true);
      }
      if (method === 'get_yield_pool_balance') {
        return nativeToScVal(75000000n, { type: 'i128' });
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    const status = await getProtocolStatus({ contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });

    expect(status.status).toBe('ok');
    expect(status.paused).toBe(true);
    expect(status.yieldPool).toBe(75000000n);
    expect(typeof status.fetchedAt).toBe('number');

    spy.mockRestore();
  });

  it('yields unavailable when RPC error occurs', async () => {
    const spy = vi.spyOn(txModule, 'simulateRead').mockRejectedValue(new Error('RPC network timeout'));

    const status = await getProtocolStatus({ contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });

    expect(status.status).toBe('unavailable');
    expect(status.paused).toBe(false);
    expect(status.yieldPool).toBe(0n);
    expect(status.error).toContain('RPC network timeout');

    spy.mockRestore();
  });
});

describe('policy table documentation and action gating', () => {
  const ALL_ACTIONS: EscrowAction[] = [
    'create_commitment',
    'create_commitment_default',
    'fund_escrow',
    'refund',
    'refund_partial',
    'early_exit',
    'release',
    'settle',
  ];

  it('has an entry for every known action with contract documentation', () => {
    for (const action of ALL_ACTIONS) {
      const policy = ACTION_POLICIES[action];
      expect(policy).toBeDefined();
      expect(policy.action).toBe(action);
      expect(typeof policy.pausedBlocked).toBe('boolean');
      expect(policy.contractDoc).toContain('contracts/escrow/src/lib.rs');

      if (policy.pausedBlocked) {
        expect(policy.pausedReason).toBeDefined();
        expect(policy.pausedReason?.length).toBeGreaterThan(0);
      }
    }
  });

  it('correctly reports blocked status and pause reasons', () => {
    // Actions blocked when paused
    expect(isActionBlocked('create_commitment', true)).toBe(true);
    expect(isActionBlocked('create_commitment_default', true)).toBe(true);
    expect(isActionBlocked('fund_escrow', true)).toBe(true);
    expect(isActionBlocked('refund', true)).toBe(true);
    expect(isActionBlocked('refund_partial', true)).toBe(true);
    expect(isActionBlocked('early_exit', true)).toBe(true);

    // Actions NOT blocked when paused (settlement remains open)
    expect(isActionBlocked('release', true)).toBe(false);
    expect(isActionBlocked('settle', true)).toBe(false);

    // When contract is not paused, nothing is blocked
    for (const action of ALL_ACTIONS) {
      expect(isActionBlocked(action, false)).toBe(false);
      expect(getActionPauseReason(action, false)).toBeUndefined();
    }

    expect(getActionPauseReason('early_exit', true)).toContain('paused');
  });

  it('evaluates yield pool coverage correctly', () => {
    // equal to pool -> covered (not uncovered)
    expect(isPayoutUncovered(100n, 100n)).toBe(false);
    // below pool -> covered
    expect(isPayoutUncovered(50n, 100n)).toBe(false);
    // above pool -> uncovered
    expect(isPayoutUncovered(150n, 100n)).toBe(true);
    expect(COVERAGE_WARNING_MESSAGE).toContain('Yield pool currently cannot cover this payout');
  });
});
