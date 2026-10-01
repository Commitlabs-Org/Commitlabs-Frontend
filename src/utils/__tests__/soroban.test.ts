import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getContractAddress } from '../../lib/backend/config';

vi.mock('../../lib/backend/config', () => ({
  getContractAddress: vi.fn(),
}));

import * as sorobanModule from '../soroban';

const mockedGetContractAddress = vi.mocked(getContractAddress);

async function importFreshSoroban() {
  vi.resetModules();
  return import('../soroban');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('soroban network configuration', () => {
  it('falls back to the testnet RPC URL and network passphrase when env vars are unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_SOROBAN_RPC_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_NETWORK_PASSPHRASE', undefined);

    const { rpcUrl, networkPassphrase } = await importFreshSoroban();

    expect(rpcUrl).toBe('https://soroban-testnet.stellar.org:443');
    expect(networkPassphrase).toBe('Test SDF Network ; September 2015');
  });

  it('uses the configured RPC URL and network passphrase when env vars are set', async () => {
    const customRpcUrl = 'https://custom-soroban-rpc.stellar.org';
    const customPassphrase = 'Custom SDF Network ; 2026';
    vi.stubEnv('NEXT_PUBLIC_SOROBAN_RPC_URL', customRpcUrl);
    vi.stubEnv('NEXT_PUBLIC_NETWORK_PASSPHRASE', customPassphrase);

    const { rpcUrl, networkPassphrase } = await importFreshSoroban();

    expect(rpcUrl).toBe(customRpcUrl);
    expect(networkPassphrase).toBe(customPassphrase);
  });
});

describe('contractAddresses getters', () => {
  it('returns the configured address from getContractAddress for each getter', () => {
    const addresses: Record<string, string> = {
      commitmentNFT: 'CA_NFT_123',
      commitmentCore: 'CA_CORE_456',
      attestationEngine: 'CA_ATTESTATION_789',
    };
    mockedGetContractAddress.mockImplementation((key: string) => addresses[key] ?? '');

    expect(sorobanModule.contractAddresses.commitmentNFT).toBe('CA_NFT_123');
    expect(sorobanModule.contractAddresses.commitmentCore).toBe('CA_CORE_456');
    expect(sorobanModule.contractAddresses.attestationEngine).toBe('CA_ATTESTATION_789');
    expect(mockedGetContractAddress).toHaveBeenCalledWith('commitmentNFT');
    expect(mockedGetContractAddress).toHaveBeenCalledWith('commitmentCore');
    expect(mockedGetContractAddress).toHaveBeenCalledWith('attestationEngine');
  });

  it('falls back to an empty string for each getter when getContractAddress throws', () => {
    mockedGetContractAddress.mockImplementation((key: string) => {
      throw new Error(`Contract "${key}" is not configured`);
    });

    expect(sorobanModule.contractAddresses.commitmentNFT).toBe('');
    expect(sorobanModule.contractAddresses.commitmentCore).toBe('');
    expect(sorobanModule.contractAddresses.attestationEngine).toBe('');
    expect(mockedGetContractAddress).toHaveBeenCalledWith('commitmentNFT');
    expect(mockedGetContractAddress).toHaveBeenCalledWith('commitmentCore');
    expect(mockedGetContractAddress).toHaveBeenCalledWith('attestationEngine');
  });

  it('always returns strings even when address resolution fails', () => {
    mockedGetContractAddress.mockImplementation(() => {
      throw new Error('Simulated configuration failure');
    });

    expect(typeof sorobanModule.contractAddresses.commitmentNFT).toBe('string');
    expect(typeof sorobanModule.contractAddresses.commitmentCore).toBe('string');
    expect(typeof sorobanModule.contractAddresses.attestationEngine).toBe('string');
  });
});

describe('removed wallet/contract stubs', () => {
  it('does not export the removed connectWallet/callContract/readContract stubs', () => {
    expect(sorobanModule).not.toHaveProperty('connectWallet');
    expect(sorobanModule).not.toHaveProperty('callContract');
    expect(sorobanModule).not.toHaveProperty('readContract');
  });
});
