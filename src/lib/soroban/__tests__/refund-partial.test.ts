import { nativeToScVal, scValToNative, Keypair } from '@stellar/stellar-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refundPartial } from '../escrow';
import { invokeContract } from '../tx';

vi.mock('../tx', () => ({
  invokeContract: vi.fn(),
}));

const caller = Keypair.random().publicKey();

beforeEach(() => vi.resetAllMocks());

describe('refundPartial', () => {
  it('rejects non-numeric commitment ids and non-positive amounts locally', async () => {
    await expect(refundPartial({ commitmentId: 'CMT-1', caller, amount: 1n })).rejects.toThrow(
      'not on-chain',
    );
    await expect(refundPartial({ commitmentId: '42', caller, amount: 0n })).rejects.toThrow(
      'greater than zero',
    );
    expect(invokeContract).not.toHaveBeenCalled();
  });

  it('invokes refund_partial with a u64 commitment id and i128 stroop amount', async () => {
    vi.mocked(invokeContract).mockResolvedValue({
      transactionHash: 'tx-partial',
      returnValue: nativeToScVal(9_500_000n, { type: 'i128' }),
    });

    const result = await refundPartial({ commitmentId: '42', caller, amount: 10_000_000n });
    const call = vi.mocked(invokeContract).mock.calls[0]![0];
    expect(call.method).toBe('refund_partial');
    expect(call.source).toBe(caller);
    expect(call.signer).toBe(caller);
    expect(scValToNative(call.args[0]!)).toBe(42n);
    expect(scValToNative(call.args[1]!)).toBe(10_000_000n);
    expect(result).toEqual({ transactionHash: 'tx-partial', refundAmount: 9_500_000n });
  });

  it('fails deterministically when the successful transaction has no decodable return value', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'tx-no-result' });
    await expect(refundPartial({ commitmentId: '42', caller, amount: 10_000_000n })).rejects.toThrow(
      /did not return the refund amount/,
    );
  });
});
