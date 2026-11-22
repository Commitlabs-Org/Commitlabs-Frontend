import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, nativeToScVal } from '@stellar/stellar-sdk';
import {
  openDispute,
  getDispute,
  DisputeCategory,
  decodePendingTransfer,
  getPendingOwner,
  proposeTransfer,
  acceptTransfer,
  cancelTransfer,
} from '../escrow';
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

describe('decodePendingTransfer', () => {
  const recipient = Keypair.random().publicKey();
  const timestamp = 1735689600n;

  it('decodes Option::None (empty vec, null, undefined, none object) as null', () => {
    expect(decodePendingTransfer(null)).toBeNull();
    expect(decodePendingTransfer(undefined)).toBeNull();
    expect(decodePendingTransfer([])).toBeNull();
    expect(decodePendingTransfer({ none: true })).toBeNull();
    expect(decodePendingTransfer({})).toBeNull();
  });

  it('decodes Option::Some struct map with snake_case field names', () => {
    const record = decodePendingTransfer({
      to: recipient,
      expires_at: timestamp,
    });
    expect(record).not.toBeNull();
    expect(record?.to).toBe(recipient);
    expect(record?.rawExpiresAt).toBe(timestamp);
    expect(record?.expiresAt.getTime()).toBe(Number(timestamp) * 1000);
  });

  it('decodes Option::Some wrapped in single-element vec', () => {
    const record = decodePendingTransfer([
      {
        to: recipient,
        expires_at: timestamp,
      },
    ]);
    expect(record).not.toBeNull();
    expect(record?.to).toBe(recipient);
    expect(record?.rawExpiresAt).toBe(timestamp);
    expect(record?.expiresAt.getTime()).toBe(Number(timestamp) * 1000);
  });

  it('decodes Option::Some wrapped in { some: ... } object', () => {
    const record = decodePendingTransfer({
      some: {
        to: recipient,
        expires_at: timestamp,
      },
    });
    expect(record).not.toBeNull();
    expect(record?.to).toBe(recipient);
    expect(record?.rawExpiresAt).toBe(timestamp);
    expect(record?.expiresAt.getTime()).toBe(Number(timestamp) * 1000);
  });

  it('decodes positional pending transfer array [to, expires_at]', () => {
    const record = decodePendingTransfer([recipient, timestamp]);
    expect(record).not.toBeNull();
    expect(record?.to).toBe(recipient);
    expect(record?.rawExpiresAt).toBe(timestamp);
    expect(record?.expiresAt.getTime()).toBe(Number(timestamp) * 1000);
  });
});

describe('getPendingOwner', () => {
  const recipient = Keypair.random().publicKey();

  it('returns null when simulation errors', async () => {
    vi.mocked(simulateRead).mockResolvedValue({ error: 'Contract read failed' });
    expect(await getPendingOwner('1')).toBeNull();
  });

  it('returns null when there is no pending transfer record', async () => {
    vi.mocked(simulateRead).mockResolvedValue({ result: null });
    expect(await getPendingOwner('1')).toBeNull();
  });

  it('returns null for an invalid commitment ID', async () => {
    expect(await getPendingOwner('not-a-number')).toBeNull();
    expect(simulateRead).not.toHaveBeenCalled();
  });

  it('decodes an on-chain Option::Some pending transfer record', async () => {
    const timestamp = 1735689600n;
    vi.mocked(simulateRead).mockResolvedValue({
      result: nativeToScVal([
        {
          to: recipient,
          expires_at: timestamp,
        },
      ]),
    } as any);

    const record = await getPendingOwner('42');
    expect(record).not.toBeNull();
    expect(record?.to).toBe(recipient);
    expect(record?.rawExpiresAt).toBe(timestamp);
  });

  it('returns null for Option::None (empty vec)', async () => {
    vi.mocked(simulateRead).mockResolvedValue({
      result: nativeToScVal([]),
    } as any);

    const record = await getPendingOwner('42');
    expect(record).toBeNull();
  });
});

describe('proposeTransfer', () => {
  const newOwner = Keypair.random().publicKey();

  it('rejects an invalid G-address before invoking transaction', async () => {
    await expect(
      proposeTransfer({ commitmentId: '1', caller, newOwner: 'invalid-address' }),
    ).rejects.toThrow(/Invalid Stellar address/);
    expect(invokeContract).not.toHaveBeenCalled();
  });

  it('rejects empty address', async () => {
    await expect(
      proposeTransfer({ commitmentId: '1', caller, newOwner: '' }),
    ).rejects.toThrow(/Invalid Stellar address/);
    expect(invokeContract).not.toHaveBeenCalled();
  });

  it('rejects non-numeric commitment id', async () => {
    await expect(
      proposeTransfer({ commitmentId: 'invalid-id', caller, newOwner }),
    ).rejects.toThrow(/not on-chain/);
    expect(invokeContract).not.toHaveBeenCalled();
  });

  it('submits transfer_ownership via invokeContract', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'txhash123' });

    const result = await proposeTransfer({ commitmentId: '1', caller, newOwner });
    expect(result.transactionHash).toBe('txhash123');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'transfer_ownership',
      args: expect.any(Array),
      source: caller,
      signer: caller,
    });
  });
});

describe('acceptTransfer', () => {
  it('rejects non-numeric commitment id', async () => {
    await expect(
      acceptTransfer({ commitmentId: 'invalid-id', caller }),
    ).rejects.toThrow(/not on-chain/);
    expect(invokeContract).not.toHaveBeenCalled();
  });

  it('submits accept_ownership via invokeContract', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'txaccept' });

    const result = await acceptTransfer({ commitmentId: '1', caller });
    expect(result.transactionHash).toBe('txaccept');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'accept_ownership',
      args: expect.any(Array),
      source: caller,
      signer: caller,
    });
  });
});

describe('cancelTransfer', () => {
  it('rejects non-numeric commitment id', async () => {
    await expect(
      cancelTransfer({ commitmentId: 'invalid-id', caller }),
    ).rejects.toThrow(/not on-chain/);
    expect(invokeContract).not.toHaveBeenCalled();
  });

  it('submits cancel_ownership_transfer via invokeContract', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'txcancel' });

    const result = await cancelTransfer({ commitmentId: '1', caller });
    expect(result.transactionHash).toBe('txcancel');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'cancel_ownership_transfer',
      args: expect.any(Array),
      source: caller,
      signer: caller,
    });
  });
});
