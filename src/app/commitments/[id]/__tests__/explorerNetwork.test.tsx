// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const TESTNET = 'Test SDF Network ; September 2015';
const MAINNET = 'Public Global Stellar Network ; September 2015';

vi.mock('@/lib/clientEnv', () => ({
  getValidatedClientEnv: vi.fn(),
}));

import { getValidatedClientEnv } from '@/lib/clientEnv';

const mockGetValidatedClientEnv = vi.mocked(getValidatedClientEnv);

describe('getAppExplorerNetwork', () => {
  const originalPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalPassphrase === undefined) {
      delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    } else {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = originalPassphrase;
    }
  });

  it('resolves to "public" when the validated client env reports the mainnet passphrase', async () => {
    mockGetValidatedClientEnv.mockReturnValue({
      NEXT_PUBLIC_NETWORK_PASSPHRASE: MAINNET,
    });

    const { getAppExplorerNetwork } = await import('../explorerNetwork');

    expect(getAppExplorerNetwork()).toBe('public');
  });

  it('resolves to "testnet" when the validated client env reports the testnet passphrase', async () => {
    mockGetValidatedClientEnv.mockReturnValue({
      NEXT_PUBLIC_NETWORK_PASSPHRASE: TESTNET,
    });

    const { getAppExplorerNetwork } = await import('../explorerNetwork');

    expect(getAppExplorerNetwork()).toBe('testnet');
  });

  it('falls back to raw process.env and then the built-in default when client env validation throws', async () => {
    mockGetValidatedClientEnv.mockImplementation(() => {
      throw new Error('validation failed');
    });
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = MAINNET;

    const { getAppExplorerNetwork } = await import('../explorerNetwork');

    expect(getAppExplorerNetwork()).toBe('public');
  });

  it('defaults to "testnet" when nothing is configured', async () => {
    mockGetValidatedClientEnv.mockReturnValue({
      NEXT_PUBLIC_NETWORK_PASSPHRASE: undefined,
    });
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

    const { getAppExplorerNetwork } = await import('../explorerNetwork');

    expect(getAppExplorerNetwork()).toBe('testnet');
  });
});
