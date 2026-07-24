import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getBackendConfig, _resetEnvCache } from '@/lib/backend/config';
import { getValidatedEnv } from '@/lib/backend/env';

// Mock env.ts to control environment variables
vi.mock('@/lib/backend/env', async (importOriginal) => {
  const actual = await importOriginal<any>();
  let mockEnv: any = {};
  return {
    ...actual,
    getValidatedEnv: vi.fn(() => mockEnv),
    _setMockEnv: (env: any) => { mockEnv = env; },
  };
});

import { _setMockEnv } from '@/lib/backend/env';

describe('Contract Versioning Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetEnvCache();
  });

  it('falls back to legacy env vars when no JSON config is provided', () => {
    _setMockEnv({
      NODE_ENV: 'test',
      COMMITMENT_CORE_CONTRACT: '0xlegacy',
      COMMITMENT_NFT_CONTRACT: '0xnft',
      ATTESTATION_ENGINE_CONTRACT: '0xattest',
    });

    const config = getBackendConfig();
    expect(config.contractAddresses.commitmentCore).toBe('0xlegacy');
    expect(config.contractAddresses.commitmentNFT).toBe('0xnft');
    expect(config.contractAddresses.attestationEngine).toBe('0xattest');
  });

  it('uses versioned config from JSON when provided', () => {
    const contractsJson = JSON.stringify({
      v1: {
        commitmentCore: { address: '0xv1core' },
        commitmentNFT: { address: '0xv1nft' },
        attestationEngine: { address: '0xv1attest' },
      },
      v2: {
        commitmentCore: { address: '0xv2core' },
        commitmentNFT: { address: '0xv2nft' },
        attestationEngine: { address: '0xv2attest' },
      }
    });

    _setMockEnv({
      NODE_ENV: 'test',
      NEXT_PUBLIC_CONTRACTS_JSON: contractsJson,
      NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION: 'v2',
    });

    const config = getBackendConfig();
    // This is expected to FAIL currently because getBackendConfig doesn't use versioned logic
    expect(config.contractAddresses.commitmentCore).toBe('0xv2core');
    expect(config.activeVersion).toBe('v2');
  });

  it('throws error when active version is missing from JSON', () => {
    const contractsJson = JSON.stringify({
      v1: {
        commitmentCore: { address: '0xv1core' },
      }
    });

    _setMockEnv({
      NODE_ENV: 'test',
      NEXT_PUBLIC_CONTRACTS_JSON: contractsJson,
      NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION: 'v99',
    });

    expect(() => getBackendConfig()).toThrow(/Active contract version "v99" not found/);
  });
});
