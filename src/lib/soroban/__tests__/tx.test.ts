import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, Operation, nativeToScVal } from '@stellar/stellar-sdk';
import { formatFeeXlm, invokeContract, prepareInvocation, simulateRead, submitPrepared } from '../tx';
import { isConnected, getPublicKey, signTransaction } from '@stellar/freighter-api';

const mockSendTransaction = vi.fn();
const mockPollTransaction = vi.fn();
const mockSimulateTransaction = vi.fn();
const mockGetAccount = vi.fn();
const mockGetLatestLedger = vi.fn();

const mockServer = {
  sendTransaction: mockSendTransaction,
  pollTransaction: mockPollTransaction,
  simulateTransaction: mockSimulateTransaction,
  getAccount: mockGetAccount,
  getLatestLedger: mockGetLatestLedger,
};

vi.mock('@/lib/config', () => {
  const config = {
    escrowContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHP',
    passphrase: 'Test SDF Network ; September 2015',
    sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
    networkDetails: { label: 'Futurenet' },
  };
  return { config, getActiveConfig: () => config };
});

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  getPublicKey: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock('@stellar/stellar-sdk', async (importActual) => {
  const actual = await importActual<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: vi.fn().mockImplementation(() => mockServer),
    },
    TransactionBuilder: class {
      addOperation = vi.fn().mockReturnThis();
      setTimeout = vi.fn().mockReturnThis();
      build = vi.fn().mockReturnValue({ toXDR: () => 'tx-xdr' });
      toXDR = () => 'tx-xdr';
    },
    Transaction: vi.fn(),
    Account: vi.fn(),
    BASE_FEE: 100,
    Operation: Object.assign(actual.Operation, {
      invokeContractFunction: vi.fn().mockReturnValue({ type: 'invokeContractFunction' }),
    }),
    Keypair: { random: vi.fn().mockReturnValue({ publicKey: () => 'GCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHP' }) },
    xdr: actual.xdr,
    nativeToScVal: actual.nativeToScVal,
    scValToNative: actual.scValToNative,
    Address: actual.Address,
  };
});

import { rpc } from '@stellar/stellar-sdk';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isConnected).mockResolvedValue(true);
  vi.mocked(getPublicKey).mockResolvedValue('GCALLER');
  vi.mocked(signTransaction).mockResolvedValue('signed');
  mockGetAccount.mockResolvedValue({ sequence: '1' });
  mockGetLatestLedger.mockResolvedValue({ sequence: 100 });
  mockSimulateTransaction.mockResolvedValue({
    transactionData: {},
    minResourceFee: '4500',
    result: { retval: { type: 'scvVoid', value: null } },
  });
  mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'tx-hash' });
  mockPollTransaction.mockResolvedValue({ status: 'SUCCESS', resultXdr: '' });
  vi.mocked(rpc.Server).mockImplementation(() => mockServer as unknown as rpc.Server);
  vi.mocked(Keypair.random).mockReturnValue({
    publicKey: () => 'GCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHP',
  } as unknown as Keypair);
  vi.mocked(Operation).invokeContractFunction = vi.fn().mockReturnValue({ type: 'invokeContractFunction' });
});

describe('invokeContract', () => {
  it('submits and polls a dispute transaction', async () => {
    const res = await invokeContract({
      method: 'dispute',
      args: [],
      source: 'GCALLER',
      signer: 'GCALLER',
    });
    expect(res.transactionHash).toBe('tx-hash');
    expect(vi.mocked(signTransaction)).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalledWith(expect.anything());
    expect(mockPollTransaction).toHaveBeenCalledWith('tx-hash', { attempts: 60 });
  });

  it('throws when wallet is not connected', async () => {
    vi.mocked(isConnected).mockResolvedValue(false);
    await expect(
      invokeContract({ method: 'dispute', args: [], source: 'GCALLER', signer: 'GCALLER' }),
    ).rejects.toThrow('Freighter wallet is not connected.');
  });

  it('throws on simulation error', async () => {
    mockSimulateTransaction.mockResolvedValue({ error: 'InvalidState' } as any);
    await expect(
      invokeContract({ method: 'dispute', args: [], source: 'GCALLER', signer: 'GCALLER' }),
    ).rejects.toThrow();
  });
});

describe('prepareInvocation and submitPrepared', () => {
  it('returns fee from simulation.minResourceFee + BASE_FEE and does not call signTransaction', async () => {
    mockSimulateTransaction.mockResolvedValue({
      transactionData: {},
      minResourceFee: '42900',
      result: {
        retval: nativeToScVal(10_000_000_000n),
        auth: [{ credentials: 'address' }],
      },
    });

    const prepared = await prepareInvocation({
      method: 'dispute',
      args: [nativeToScVal(1n), nativeToScVal('GCALLER'), nativeToScVal('payout mismatch')],
      source: 'GCALLER',
      signer: 'GCALLER',
    });

    expect(prepared.method).toBe('dispute');
    expect(prepared.args).toEqual([1n, 'GCALLER', 'payout mismatch']);
    expect(prepared.minResourceFee).toBe(42_900n);
    expect(prepared.baseFee).toBe(100n);
    expect(prepared.fee).toBe(43_000n);
    expect(prepared.feeXlm).toBe('0.0043000');
    expect(prepared.returnValue).toBe(10_000_000_000n);
    expect(prepared.authEntries).toHaveLength(1);
    expect(vi.mocked(signTransaction)).not.toHaveBeenCalled();
  });

  it('surfaces simulation errors through toTxError before returning a preview', async () => {
    mockSimulateTransaction.mockResolvedValue({
      error: 'HostError: Error(Contract, #6)',
    } as any);

    await expect(
      prepareInvocation({
        method: 'dispute',
        args: [],
        source: 'GCALLER',
        signer: 'GCALLER',
      }),
    ).rejects.toThrow('This commitment cannot be changed in its current state.');
    expect(vi.mocked(signTransaction)).not.toHaveBeenCalled();
  });

  it('submits a prepared invocation when confirmed', async () => {
    const prepared = await prepareInvocation({
      method: 'dispute',
      args: [],
      source: 'GCALLER',
      signer: 'GCALLER',
    });
    expect(vi.mocked(signTransaction)).not.toHaveBeenCalled();

    const res = await submitPrepared(prepared);
    expect(vi.mocked(signTransaction)).toHaveBeenCalledWith('tx-xdr', {
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    expect(res.transactionHash).toBe('tx-hash');
  });
});

describe('formatFeeXlm', () => {
  it('formats stroop fees to XLM with 7 decimal places using bigint math', () => {
    expect(formatFeeXlm(100n)).toBe('0.0000100');
    expect(formatFeeXlm(43_000n)).toBe('0.0043000');
    expect(formatFeeXlm(10_000_000n)).toBe('1.0000000');
    expect(formatFeeXlm(12_345_678_901n)).toBe('1,234.5678901');
    expect(formatFeeXlm(0n)).toBe('0.0000000');
  });
});

describe('simulateRead', () => {
  it('returns the simulated retval', async () => {
    const res = await simulateRead({ method: 'get_dispute', args: [], source: 'GCALLER' });
    expect(res.result).toBeDefined();
  });

  it('returns an error when simulation fails', async () => {
    mockSimulateTransaction.mockRejectedValue(new Error('rpc down'));
    const res = await simulateRead({ method: 'get_dispute', args: [], source: 'GCALLER' });
    expect(res.error).toBeDefined();
  });
});

describe('rpc simulation helpers', () => {
  it('exposes the simulation type guards', () => {
    expect(typeof rpc.Api.isSimulationError).toBe('function');
    expect(typeof rpc.Api.isSimulationSuccess).toBe('function');
  });
});
