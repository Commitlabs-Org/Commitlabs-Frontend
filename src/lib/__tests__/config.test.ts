import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseConfig, explorerContractUrl, explorerTx, explorerAccount } from '../config';
import { NETWORKS } from '../network';

describe('Runtime Network Configuration & Helpers', () => {
  const validContractId = 'CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4';

  it('valid configs for each network (testnet, futurenet, mainnet)', () => {
    for (const net of ['testnet', 'futurenet', 'mainnet'] as const) {
      const cfg = parseConfig({
        NEXT_PUBLIC_STELLAR_NETWORK: net,
        NEXT_PUBLIC_ESCROW_CONTRACT_ID: validContractId,
      });

      expect(cfg.network).toBe(net);
      expect(cfg.passphrase).toBe(NETWORKS[net].passphrase);
      expect(cfg.horizonUrl).toBe(NETWORKS[net].defaultHorizonUrl);
      expect(cfg.sorobanRpcUrl).toBe(NETWORKS[net].defaultSorobanRpcUrl);
      expect(cfg.escrowContractId).toBe(validContractId);
      expect(cfg.isContractConfigured).toBe(true);
    }
  });

  it('rejects invalid network identifier', () => {
    expect(() =>
      parseConfig({
        NEXT_PUBLIC_STELLAR_NETWORK: 'tesnet', // typo
      })
    ).toThrow(/Invalid network: "tesnet"/);

    expect(() =>
      parseConfig({
        NEXT_PUBLIC_STELLAR_NETWORK: 'devnet',
      })
    ).toThrow(/Invalid network: "devnet"/);
  });

  it('rejects non-https URLs', () => {
    expect(() =>
      parseConfig({
        NEXT_PUBLIC_HORIZON_URL: 'http://horizon-testnet.stellar.org',
      })
    ).toThrow(/must use https: protocol/);

    expect(() =>
      parseConfig({
        NEXT_PUBLIC_SOROBAN_RPC_URL: 'http://soroban-testnet.stellar.org',
      })
    ).toThrow(/must use https: protocol/);
  });

  it('rejects malformed contract IDs', () => {
    // Too short
    expect(() =>
      parseConfig({
        NEXT_PUBLIC_ESCROW_CONTRACT_ID: 'CBPNV',
      })
    ).toThrow(/Must be a valid 56-character Soroban contract address/);

    // Starts with G (account, not contract)
    expect(() =>
      parseConfig({
        NEXT_PUBLIC_ESCROW_CONTRACT_ID: 'GBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4',
      })
    ).toThrow(/Must be a valid 56-character Soroban contract address starting with 'C'/);

    // Invalid base32 chars (contains 0, 1, 8, 9)
    expect(() =>
      parseConfig({
        NEXT_PUBLIC_ESCROW_CONTRACT_ID: 'C0000000000000000000000000000000000000000000000000000000',
      })
    ).toThrow(/Must be a valid 56-character Soroban contract address/);
  });

  it('handles missing optional values with sensible defaults (demo mode enabled)', () => {
    const cfg = parseConfig({});
    expect(cfg.network).toBe('testnet');
    expect(cfg.escrowContractId).toBe('');
    expect(cfg.isContractConfigured).toBe(false);
    expect(cfg.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(cfg.sorobanRpcUrl).toBe('https://soroban-testnet.stellar.org');
  });

  it('explorer helpers produce correct URLs per network', () => {
    expect(explorerContractUrl(validContractId)).toContain('/contract/' + validContractId);
    expect(explorerTx('abc123hash')).toContain('/tx/abc123hash');
    expect(explorerAccount('GABCD1234')).toContain('/account/GABCD1234');
  });
});

describe('Build-Time Environment Validation Script', () => {
  const scriptPath = path.resolve(__dirname, '../../../scripts/validate-env.mjs');

  it('exits 0 with valid configuration', () => {
    const res = spawnSync('node', [scriptPath], {
      env: {
        ...process.env,
        NEXT_PUBLIC_STELLAR_NETWORK: 'testnet',
        NEXT_PUBLIC_ESCROW_CONTRACT_ID: 'CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4',
      },
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
  });

  it('exits non-zero on invalid network', () => {
    const res = spawnSync('node', [scriptPath], {
      env: {
        ...process.env,
        NEXT_PUBLIC_STELLAR_NETWORK: 'tesnet',
      },
      encoding: 'utf8',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Invalid NEXT_PUBLIC_STELLAR_NETWORK');
  });

  it('exits non-zero on malformed contract id', () => {
    const res = spawnSync('node', [scriptPath], {
      env: {
        ...process.env,
        NEXT_PUBLIC_ESCROW_CONTRACT_ID: 'invalid-id',
      },
      encoding: 'utf8',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Invalid NEXT_PUBLIC_ESCROW_CONTRACT_ID');
  });

  it('exits non-zero on non-https horizon URL', () => {
    const res = spawnSync('node', [scriptPath], {
      env: {
        ...process.env,
        NEXT_PUBLIC_HORIZON_URL: 'http://horizon-testnet.stellar.org',
      },
      encoding: 'utf8',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('must use https: protocol');
  });
});
