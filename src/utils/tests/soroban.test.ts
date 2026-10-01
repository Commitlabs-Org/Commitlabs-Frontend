import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as configModule from '../../lib/backend/config';

vi.mock('../../lib/backend/config', () => ({
  getContractAddress: vi.fn(),
}));

describe('soroban utility module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('absence of removed stubs', () => {
    it('does not export connectWallet', async () => {
      const soroban = await import('../soroban');
      expect(soroban).not.toHaveProperty('connectWallet');
    });

    it('does not export callContract', async () => {
      const soroban = await import('../soroban');
      expect(soroban).not.toHaveProperty('callContract');
    });

    it('does not export readContract', async () => {
      const soroban = await import('../soroban');
      expect(soroban).not.toHaveProperty('readContract');
    });
  });

  describe('network configuration defaults and overrides', () => {
    it('provides fallback RPC URL and network passphrase when env vars are unset', async () => {
      vi.resetModules();
      delete process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
      delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

      const soroban = await import('../soroban');
      expect(soroban.rpcUrl).toBe('https://soroban-testnet.stellar.org:443');
      expect(soroban.networkPassphrase).toBe('Test SDF Network ; September 2015');
    });

    it('uses custom RPC URL and network passphrase when env vars are defined', async () => {
      vi.resetModules();
      const customRpc = 'https://custom-soroban-rpc.stellar.org';
      const customPassphrase = 'Custom SDF Network ; 2026';
      process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = customRpc;
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = customPassphrase;

      const soroban = await import('../soroban');
      expect(soroban.rpcUrl).toBe(customRpc);
      expect(soroban.networkPassphrase).toBe(customPassphrase);
    });
  });

  describe('contractAddresses getters', () => {
    it('exports contractAddresses object with expected getters', async () => {
      const soroban = await import('../soroban');
      expect(soroban).toHaveProperty('contractAddresses');
      expect(typeof soroban.contractAddresses).toBe('object');
      expect('commitmentNFT' in soroban.contractAddresses).toBe(true);
      expect('commitmentCore' in soroban.contractAddresses).toBe(true);
      expect('attestationEngine' in soroban.contractAddresses).toBe(true);
    });

    it('falls back to empty string when getContractAddress throws', async () => {
      const mockGetContractAddress = vi.mocked(configModule.getContractAddress);
      mockGetContractAddress.mockImplementation((key: string) => {
        throw new Error(`Contract ${key} not found`);
      });

      const soroban = await import('../soroban');
      expect(soroban.contractAddresses.commitmentNFT).toBe('');
      expect(soroban.contractAddresses.commitmentCore).toBe('');
      expect(soroban.contractAddresses.attestationEngine).toBe('');
      expect(mockGetContractAddress).toHaveBeenCalledWith('commitmentNFT');
      expect(mockGetContractAddress).toHaveBeenCalledWith('commitmentCore');
      expect(mockGetContractAddress).toHaveBeenCalledWith('attestationEngine');
    });

    it('returns contract address when getContractAddress succeeds', async () => {
      const mockGetContractAddress = vi.mocked(configModule.getContractAddress);
      mockGetContractAddress.mockImplementation((key: string) => {
        const addresses: Record<string, string> = {
          commitmentNFT: 'CA_NFT_123',
          commitmentCore: 'CA_CORE_456',
          attestationEngine: 'CA_ATTESTATION_789',
        };
        return addresses[key] ?? '';
      });

      const soroban = await import('../soroban');
      expect(soroban.contractAddresses.commitmentNFT).toBe('CA_NFT_123');
      expect(soroban.contractAddresses.commitmentCore).toBe('CA_CORE_456');
      expect(soroban.contractAddresses.attestationEngine).toBe('CA_ATTESTATION_789');
    });

    it('always returns strings from contractAddresses getters', async () => {
      const mockGetContractAddress = vi.mocked(configModule.getContractAddress);
      mockGetContractAddress.mockImplementation(() => {
        throw new Error('Simulated failure');
      });

      const soroban = await import('../soroban');
      expect(typeof soroban.contractAddresses.commitmentNFT).toBe('string');
      expect(typeof soroban.contractAddresses.commitmentCore).toBe('string');
      expect(typeof soroban.contractAddresses.attestationEngine).toBe('string');
    });
  });
});
