import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scValToNative } from '@stellar/stellar-sdk';
import type { Commitment } from '@/lib/commitments';
import { getCommitment, simulateEscrowRead } from '../read';
import {
  listOwnerCommitmentIds,
  listOwnerCommitments,
  mergeCommitments,
  syncOwnerCommitments,
} from '../sync';
import type { OnChainCommitment } from '../read';

vi.mock('../read', () => ({
  getCommitment: vi.fn(),
  simulateEscrowRead: vi.fn(),
}));

const owner = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function chainRecord(id: string): OnChainCommitment {
  return {
    id,
    owner,
    asset: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
    amount: 1n,
    accruedYield: 0n,
    risk: 'Balanced',
    status: 'Funded',
    maturity: 1_700_000_000n + 86_400n,
    penaltyBps: 0,
    complianceScore: 100,
    createdAt: 1_700_000_000n,
    metadata: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listOwnerCommitmentIds', () => {
  it('pages through 250 IDs with the contract limit, then stops on an empty page', async () => {
    vi.mocked(simulateEscrowRead)
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => BigInt(index)))
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => BigInt(index + 100)))
      .mockResolvedValueOnce(Array.from({ length: 50 }, (_, index) => BigInt(index + 200)))
      .mockResolvedValueOnce([]);

    const ids = await listOwnerCommitmentIds(owner);

    expect(ids).toHaveLength(250);
    expect(ids[0]).toBe('0');
    expect(ids[249]).toBe('249');
    expect(simulateEscrowRead).toHaveBeenCalledTimes(4);
    for (const [, args] of vi.mocked(simulateEscrowRead).mock.calls) {
      expect(scValToNative(args[2]!)).toBe(100);
    }
    expect(vi.mocked(simulateEscrowRead).mock.calls.map(([, args]) => scValToNative(args[1]!))).toEqual([
      0,
      100,
      200,
      250,
    ]);
  });

  it('rejects malformed page results instead of silently treating them as empty', async () => {
    vi.mocked(simulateEscrowRead).mockResolvedValueOnce(null);
    await expect(listOwnerCommitmentIds(owner)).rejects.toThrow(/Expected a page/);
  });

  it('fetches each full commitment after collecting the owner IDs', async () => {
    vi.mocked(simulateEscrowRead).mockResolvedValueOnce([1n, 2n]).mockResolvedValueOnce([]);
    vi.mocked(getCommitment).mockImplementation(async (id) => chainRecord(String(id)));

    const commitments = await listOwnerCommitments(owner);

    expect(commitments.map((commitment) => commitment.id)).toEqual(['1', '2']);
    expect(getCommitment).toHaveBeenNthCalledWith(1, '1', undefined);
    expect(getCommitment).toHaveBeenNthCalledWith(2, '2', undefined);
  });
});

describe('mergeCommitments', () => {
  const local: Commitment = {
    id: '00042',
    type: 'safe',
    asset: 'USDC',
    amount: '10000000',
    durationDays: 14,
    maxLoss: 2,
    penalty: 2,
    apy: 5,
    createdAt: 1,
    status: 'active',
    owner: 'GOWNER',
    txHash: 'local-tx',
  };
  const demo: Commitment = { ...local, id: 'CMT-DEMO', demo: true };
  const chain: Commitment = { ...local, id: '42', status: 'settled', txHash: null };

  it('is idempotent and keeps demo records while chain status overrides stale local status', () => {
    const once = mergeCommitments([local, demo], [chain]);
    const twice = mergeCommitments(once, [chain]);

    expect(twice).toEqual(once);
    expect(twice).toHaveLength(2);
    expect(twice[0]).toMatchObject({ id: '42', status: 'settled', txHash: 'local-tx' });
    expect(twice[1]).toEqual(demo);
  });
});

describe('syncOwnerCommitments cache', () => {
  it('reuses the successful in-memory sync for the same owner', async () => {
    vi.mocked(simulateEscrowRead).mockResolvedValueOnce([]);

    await syncOwnerCommitments(owner);
    await syncOwnerCommitments(owner);

    expect(simulateEscrowRead).toHaveBeenCalledTimes(1);
    expect(getCommitment).not.toHaveBeenCalled();
  });
});
