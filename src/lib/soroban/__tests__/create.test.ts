import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAmount } from '@/lib/amount';
import { EscrowErrorCode, TxError } from '@/lib/soroban/errors';
import { RISK_PROFILES } from '@/lib/soroban/escrow-client';

const mockCreateCommitment = vi.fn();
const mockFundEscrow = vi.fn();
const mockGetEscrowClient = vi.fn(() => ({
  create_commitment: mockCreateCommitment,
  fund_escrow: mockFundEscrow,
}));

vi.mock('@stellar/freighter-api', () => ({
  signTransaction: vi.fn(),
}));

vi.mock('@/lib/soroban/escrow-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/soroban/escrow-client')>();
  return {
    ...actual,
    getEscrowClient: (...args: Parameters<typeof actual.getEscrowClient>) =>
      mockGetEscrowClient(...args),
  };
});

vi.mock('@/lib/config', () => {
  const config = {
    network: 'testnet',
    escrowContractId: 'CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4',
    escrowTokenId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    passphrase: 'Test SDF Network ; September 2015',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    isContractConfigured: true,
  };
  return {
    config,
    getActiveConfig: () => config,
    explorerContractUrl: (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`,
  };
});

import { createAndFundCommitment, fundCommitment } from '@/lib/soroban/create';

const OWNER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const TOKEN_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const CREATE_HASH = 'a'.repeat(64);
const FUND_HASH = 'b'.repeat(64);

function okResult<T>(value: T) {
  return {
    isOk: () => true,
    isErr: () => false,
    unwrap: () => value,
  };
}

function errResult(error: unknown) {
  return {
    isOk: () => false,
    isErr: () => true,
    unwrapErr: () => error,
  };
}

describe('createAndFundCommitment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls create_commitment then fund_escrow with parsed stroops and returned id', async () => {
    const parsed = parseAmount('1000.5');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('Expected valid amount');

    mockCreateCommitment.mockResolvedValue({
      signAndSend: vi.fn().mockResolvedValue({
        result: okResult(42n),
        sendTransactionResponse: { hash: CREATE_HASH },
      }),
    });
    mockFundEscrow.mockResolvedValue({
      signAndSend: vi.fn().mockResolvedValue({
        result: okResult(undefined),
        sendTransactionResponse: { hash: FUND_HASH },
      }),
    });

    const stages: string[] = [];
    const result = await createAndFundCommitment({
      owner: OWNER,
      asset: 'USDC',
      amount: parsed.value,
      risk: 'balanced',
      days: 30,
      penaltyBps: 500,
      onProgress: (stage) => stages.push(stage),
    });

    expect(stages).toEqual(['creating', 'funding']);
    expect(mockCreateCommitment).toHaveBeenCalledWith({
      owner: OWNER,
      asset: TOKEN_ID,
      amount: 10005000000n,
      risk: RISK_PROFILES.balanced,
      duration_days: 30,
      penalty_bps: 500,
      metadata: new Map(),
    });
    expect(mockFundEscrow).toHaveBeenCalledWith({
      commitment_id: 42n,
    });
    expect(result).toEqual({
      status: 'funded',
      commitmentId: '42',
      createTxHash: CREATE_HASH,
      fundTxHash: FUND_HASH,
      txHash: FUND_HASH,
    });
  });

  it('maps Paused (11) contract error to the paused TxError notice', async () => {
    mockCreateCommitment.mockResolvedValue({
      signAndSend: vi.fn().mockResolvedValue({
        result: errResult({ message: 'Paused' }),
      }),
    });

    await expect(
      createAndFundCommitment({
        owner: OWNER,
        asset: TOKEN_ID,
        amount: 10000000n,
        risk: 'safe',
        days: 14,
        penaltyBps: 200,
      })
    ).rejects.toMatchObject({
      name: 'TxError',
      kind: 'contract',
      code: EscrowErrorCode.Paused,
      message: 'Escrow actions are temporarily paused.',
    });
    expect(mockFundEscrow).not.toHaveBeenCalled();
  });

  it('maps user-rejected signature to a rejected TxError', async () => {
    mockCreateCommitment.mockResolvedValue({
      signAndSend: vi.fn().mockRejectedValue(new Error('User declined access')),
    });

    try {
      await createAndFundCommitment({
        owner: OWNER,
        asset: TOKEN_ID,
        amount: 10000000n,
        risk: 'aggressive',
        days: 60,
        penaltyBps: 1000,
      });
      expect.fail('Expected createAndFundCommitment to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(TxError);
      expect((err as TxError).kind).toBe('rejected');
    }
  });

  it('leaves a retryable record when fund_escrow fails after create_commitment', async () => {
    mockCreateCommitment.mockResolvedValue({
      signAndSend: vi.fn().mockResolvedValue({
        result: okResult(99n),
        sendTransactionResponse: { hash: CREATE_HASH },
      }),
    });
    mockFundEscrow.mockResolvedValue({
      signAndSend: vi.fn().mockRejectedValue(new Error('User rejected the transaction')),
    });

    const result = await createAndFundCommitment({
      owner: OWNER,
      asset: 'XLM',
      amount: 50000000n,
      risk: 'balanced',
      days: 30,
      penaltyBps: 500,
    });

    expect(result.status).toBe('created_unfunded');
    if (result.status !== 'created_unfunded') throw new Error('Expected created_unfunded');
    expect(result.commitmentId).toBe('99');
    expect(result.createTxHash).toBe(CREATE_HASH);
    expect(result.error).toBeInstanceOf(TxError);
    expect(result.error.kind).toBe('rejected');
  });

  it('retries funding an existing commitment via fundCommitment', async () => {
    mockFundEscrow.mockResolvedValue({
      signAndSend: vi.fn().mockResolvedValue({
        result: okResult(undefined),
        sendTransactionResponse: { hash: FUND_HASH },
      }),
    });

    const res = await fundCommitment({
      commitmentId: '99',
      owner: OWNER,
    });

    expect(mockFundEscrow).toHaveBeenCalledWith({ commitment_id: 99n });
    expect(res).toEqual({ txHash: FUND_HASH });
  });
});
