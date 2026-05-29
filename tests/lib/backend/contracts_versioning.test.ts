import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { getBackendConfig, _resetEnvCache } from '@/lib/backend/config';

// Mock config.ts
vi.mock('@/lib/backend/config', async (importOriginal) => {
  const actual = await importOriginal<any>();
  let mockVersion = 'v1';
  return {
    ...actual,
    getBackendConfig: vi.fn(() => ({
      sorobanRpcUrl: 'http://localhost',
      networkPassphrase: 'Test',
      contractAddresses: {
        commitmentCore: 'core',
        commitmentNFT: 'nft',
        attestationEngine: 'attest',
      },
      activeVersion: mockVersion,
    })),
    _setMockVersion: (v: string) => { mockVersion = v; },
  };
});

import { _setMockVersion } from '@/lib/backend/config';

// Mock counters and logger to avoid ioredis or other missing deps
vi.mock('@/lib/backend/counters/provider', () => ({
  getCountersAdapter: vi.fn(() => ({
    incrementSuccessfulActions: vi.fn(),
    incrementChainFailures: vi.fn(),
  })),
}));

vi.mock('@/lib/backend/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/backend/cache/factory', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Stellar SDK and other dependencies used by contracts.ts
vi.mock('@stellar/stellar-sdk', () => ({
  Contract: vi.fn().mockImplementation(function() {
    return {
      call: vi.fn().mockReturnValue({}),
    };
  }),
  Account: vi.fn().mockImplementation(function() {
    return {};
  }),
  TransactionBuilder: vi.fn().mockImplementation(function() {
    return {
      addOperation: vi.fn().mockReturnThis(),
      setTimeout: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({}),
    };
  }),
  nativeToScVal: vi.fn(),
  scValToNative: vi.fn(),
  Address: vi.fn().mockImplementation(function() {
    return {
      toScVal: vi.fn(),
    };
  }),
  BASE_FEE: '100',
  SorobanRpc: {
    Server: vi.fn().mockImplementation(function() {
      return {
        simulateTransaction: vi.fn().mockResolvedValue({
          result: { retval: {} }
        }),
      };
    }),
    Api: {
      isSimulationError: vi.fn().mockReturnValue(false),
    }
  }
}));

// Mock scValToNative to return a mock commitment
import { scValToNative } from '@stellar/stellar-sdk';

describe('Contracts Service Versioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SOROBAN_SOURCE_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  });

  it('includes the active version in getCommitmentFromChain response', async () => {
    _setMockVersion('v2');
    
    (scValToNative as any).mockReturnValue({
      id: 'c1',
      ownerAddress: 'addr1',
      asset: 'USDC',
      amount: '100',
      status: 'ACTIVE',
      complianceScore: 100,
      currentValue: '100',
      feeEarned: '0',
      violationCount: 0,
    });

    const result = await getCommitmentFromChain('c1');
    expect(result.id).toBe('c1');
    expect(result.contractVersion).toBe('v2');
  });
});
