import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, nativeToScVal } from '@stellar/stellar-sdk';
import { openDispute, getDispute, earlyExitCommitment, decodeEarlyExitResult, DisputeCategory } from '../escrow';
import { invokeContract, simulateRead } from '../tx';

vi.mock('../tx', () => ({
  invokeContract: vi.fn(),
  simulateRead: vi.fn(),
}));

const caller = Keypair.random().publicKey();

beforeEach(() => {
  vi.resetAllMocks();
});

describe('openDispute', () => {
  it('rejects empty reasons', async () => {
    await expect(openDispute({ commitmentId: 'CMT-1', caller, reason: '' })).rejects.toThrow(
      'Please describe the problem you want to report.',
    );
  });

  it('rejects over-long reasons', async () => {
    await expect(
      openDispute({ commitmentId: 'CMT-1', caller, reason: 'x'.repeat(1001) }),
    ).rejects.toThrow(/1000 characters/);
  });

  it('rejects non-on-chain commitment ids', async () => {
    await expect(openDispute({ commitmentId: 'not-an-id', caller, reason: 'problem' })).rejects.toThrow(
      'not on-chain',
    );
  });

  it('submits dispute via invokeContract', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'abc' });
    const res = await openDispute({
      commitmentId: '1',
      caller,
      reason: 'the payout did not match the agreed amount',
    });
    expect(res.transactionHash).toBe('abc');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'dispute',
      args: expect.any(Array),
      source: caller,
      signer: caller,
    });
  });

  it('accepts a reason exactly at the limit', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'abc' });
    await openDispute({ commitmentId: '1', caller, reason: 'x'.repeat(1000) });
    expect(invokeContract).toHaveBeenCalled();
  });
});

describe('getDispute', () => {
  it('returns null when simulation errors', async () => {
    vi.mocked(simulateRead).mockResolvedValue({ error: 'boom' });
    expect(await getDispute('1')).toBeNull();
  });

  it('returns null when there is no dispute record', async () => {
    vi.mocked(simulateRead).mockResolvedValue({ result: null });
    expect(await getDispute('1')).toBeNull();
  });

  it('decodes an Option::Some struct record with the contract field names', async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(simulateRead).mockResolvedValue({
      result: nativeToScVal([
        {
          reason_category: DisputeCategory.ValueMismatch,
          reason_text: 'payout mismatch',
          disputed_at: BigInt(now),
          disputed_by: caller,
        },
      ]),
    } as any);
    const record = await getDispute('1');
    expect(record?.reasonCategory).toBe(DisputeCategory.ValueMismatch);
    expect(record?.reasonText).toBe('payout mismatch');
    expect(record?.disputedAt.getTime()).toBe(now * 1000);
    expect(record?.disputedBy).toBe(caller);
  });

  it('returns null for an Option::None (empty vec) result', async () => {
    vi.mocked(simulateRead).mockResolvedValue({ result: nativeToScVal([]) } as any);
    expect(await getDispute('1')).toBeNull();
  });

  it('decodes a positional dispute record', async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(simulateRead).mockResolvedValue({
      result: nativeToScVal([
        DisputeCategory.FraudSuspicion,
        'The payout did not match the agreed amount.',
        BigInt(now),
        caller,
      ]),
    } as any);
    const record = await getDispute('1');
    expect(record?.reasonCategory).toBe(DisputeCategory.FraudSuspicion);
    expect(record?.reasonText).toBe('The payout did not match the agreed amount.');
    expect(record?.disputedAt.getTime()).toBe(now * 1000);
    expect(record?.disputedBy).toBe(caller);
  });

  it('treats unknown categories as Other', async () => {
    vi.mocked(simulateRead).mockResolvedValue({
      result: nativeToScVal([99, 'weird', BigInt(Math.floor(Date.now() / 1000)), caller]),
    } as any);
    const record = await getDispute('1');
    expect(record?.reasonCategory).toBe(DisputeCategory.Other);
  });
});

describe('earlyExitCommitment', () => {
  it('rejects non-on-chain commitment ids', async () => {
    await expect(earlyExitCommitment({ commitmentId: 'CMT-1', caller })).rejects.toThrow(
      'not on-chain',
    );
    expect(invokeContract).not.toHaveBeenCalled();
  });

  it('sends early_exit_commitment(id, caller) and decodes EarlyExitResult', async () => {
    vi.mocked(invokeContract).mockResolvedValue({
      transactionHash: 'tx-exit-123',
      returnValue: nativeToScVal({
        exit_amount: 9_500_000_000n,
        penalty_amount: 500_000_000n,
        final_status: 'Exited',
      }),
    });

    const res = await earlyExitCommitment({ commitmentId: '42', caller });
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'early_exit_commitment',
      args: [expect.anything(), expect.anything()],
      source: caller,
      signer: caller,
    });
    expect(res).toEqual({
      transactionHash: 'tx-exit-123',
      exitAmount: 9_500_000_000n,
      penaltyAmount: 500_000_000n,
      finalStatus: 'Exited',
    });
  });

  it('throws when the transaction succeeds without a returnValue', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'tx-no-val' });
    await expect(earlyExitCommitment({ commitmentId: '42', caller })).rejects.toThrow(
      /EarlyExitResult/,
    );
  });

  it('decodes positional EarlyExitResult tuples', () => {
    expect(decodeEarlyExitResult([9_000n, 1_000n, ['Exited']])).toEqual({
      exitAmount: 9_000n,
      penaltyAmount: 1_000n,
      finalStatus: 'Exited',
    });
  });
});
