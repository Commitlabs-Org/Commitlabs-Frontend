import { describe, it, expect } from 'vitest';
import { checkWalletBoundary, checkNetworkOnly } from './walletBoundary';

describe('checkWalletBoundary', () => {
  it('fails when disconnected', () => {
    const r = checkWalletBoundary({
      connected: false,
      address: '',
      authenticated: false,
      walletNetwork: null,
      expectedNetwork: null,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('DISCONNECTED');
  });
  it('fails on wrong network', () => {
    const r = checkWalletBoundary({
      connected: true,
      address: 'GABC',
      authenticated: true,
      walletNetwork: 'Public Global Stellar Network ; September 2015',
      expectedNetwork: 'Test SDF Network ; September 2015',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('WRONG_NETWORK');
  });
  it('fails when unauthenticated', () => {
    const r = checkWalletBoundary({
      connected: true,
      address: 'GABC',
      authenticated: false,
      walletNetwork: null,
      expectedNetwork: null,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('UNAUTHENTICATED');
  });
  it('passes when all ok', () => {
    const r = checkWalletBoundary({
      connected: true,
      address: 'GABC',
      authenticated: true,
      walletNetwork: null,
      expectedNetwork: null,
    });
    expect(r.ok).toBe(true);
  });
  it('passes when network matches expected', () => {
    const net = 'Test SDF Network ; September 2015';
    const r = checkWalletBoundary({
      connected: true,
      address: 'GABC',
      authenticated: true,
      walletNetwork: net,
      expectedNetwork: net,
    });
    expect(r.ok).toBe(true);
  });
});

describe('checkNetworkOnly', () => {
  it('detects mismatch', () => {
    expect(checkNetworkOnly('a', 'b').ok).toBe(false);
  });
  it('passes on null walletNetwork', () => {
    expect(checkNetworkOnly(null, 'b').ok).toBe(true);
  });
});
