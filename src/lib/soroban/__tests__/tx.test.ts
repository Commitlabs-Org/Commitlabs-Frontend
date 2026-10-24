import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, Operation } from '@stellar/stellar-sdk';
import { invokeContract, simulateRead } from '../tx';
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

vi.mock('@/lib/config', () => ({
  config: {
    escrowContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHP',
    passphrase: 'Test SDF Network ; September 2015',
    sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
    networkDetails: { label: 'Futurenet' },
  },
}));

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
