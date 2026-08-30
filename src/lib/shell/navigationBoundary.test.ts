import { describe, expect, it } from 'vitest';
import {
  canActivateNavItem,
  evaluateNavigationBoundary,
  isValidStellarAddress,
  normalizePathname,
  validateSessionSnapshot,
} from './navigationBoundary';

const ADDRESS = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';
const OTHER = 'GOTHERGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX';
const NETWORK = 'Test SDF Network ; September 2015';

const connected = {
  address: ADDRESS,
  connected: true,
  networkPassphrase: NETWORK,
  expectedNetworkPassphrase: NETWORK,
};

describe('navigationBoundary validators', () => {
  it('accepts a well-formed public route without a wallet', () => {
    const decision = evaluateNavigationBoundary({ pathname: '/' }, { connected: false });
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.route.protected).toBe(false);
      expect(decision.auth).toBeNull();
    }
  });

  it('rejects path traversal and unknown routes', () => {
    expect(normalizePathname('../etc/passwd')).toBeNull();
    expect(evaluateNavigationBoundary({ pathname: '/admin' }, connected).ok).toBe(false);
    expect(evaluateNavigationBoundary({ pathname: '/create/%2e%2e' }, connected).code).toBe(
      'INVALID_ROUTE',
    );
  });

  it('requires a real wallet identity on protected pages, not a connected flag', () => {
    const flaggedOnly = evaluateNavigationBoundary(
      { pathname: '/create' },
      { connected: true, address: 'not-an-address', networkPassphrase: NETWORK },
    );
    expect(flaggedOnly).toMatchObject({
      ok: false,
      code: 'DISCONNECTED_WALLET',
      recoverable: true,
    });

    const disconnected = evaluateNavigationBoundary(
      { pathname: '/settings' },
      { connected: false, address: ADDRESS, networkPassphrase: NETWORK },
    );
    expect(disconnected.code).toBe('DISCONNECTED_WALLET');
  });

  it('rejects wrong-network and missing network membership', () => {
    const wrong = evaluateNavigationBoundary(
      { pathname: '/analytics' },
      { ...connected, networkPassphrase: 'Public Global Stellar Network ; September 2015' },
    );
    expect(wrong).toMatchObject({ ok: false, code: 'WRONG_NETWORK', recoverable: true });

    const missing = evaluateNavigationBoundary(
      { pathname: '/analytics' },
      { ...connected, networkPassphrase: '' },
    );
    expect(missing.code).toBe('WRONG_NETWORK');
  });

  it('rejects tampered ownership hints that do not match the wallet', () => {
    const decision = evaluateNavigationBoundary(
      { pathname: '/settings', search: { owner: OTHER } },
      connected,
    );
    expect(decision).toMatchObject({ ok: false, code: 'TAMPERED_OWNERSHIP', recoverable: false });
  });

  it('accepts matching owner hints and safe numeric params', () => {
    const decision = evaluateNavigationBoundary(
      { pathname: '/create', search: `?owner=${ADDRESS}&step=2&limit=20` },
      connected,
    );
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.route.numericParams).toEqual({ step: 2, limit: 20 });
      expect(decision.auth?.address).toBe(ADDRESS);
    }
  });

  it('rejects hostile numeric values', () => {
    expect(
      evaluateNavigationBoundary({ pathname: '/analytics', search: { page: '-1' } }, connected)
        .code,
    ).toBe('INVALID_NUMERIC');
    expect(
      evaluateNavigationBoundary(
        { pathname: '/analytics', search: { limit: '9007199254740993' } },
        connected,
      ).code,
    ).toBe('INVALID_NUMERIC');
    expect(
      evaluateNavigationBoundary({ pathname: '/analytics', search: { amount: '1e2' } }, connected)
        .code,
    ).toBe('INVALID_NUMERIC');
  });

  it('covers replay: expired, future, and reused nonce', () => {
    const now = 1_700_000_000_000;
    const expired = evaluateNavigationBoundary({ pathname: '/create' }, connected, {
      issuedAt: now - 10 * 60 * 1000,
      now,
    });
    expect(expired).toMatchObject({ ok: false, code: 'REPLAYED_REQUEST', recoverable: true });

    const future = evaluateNavigationBoundary({ pathname: '/create' }, connected, {
      issuedAt: now + 60_000,
      now,
    });
    expect(future.code).toBe('REPLAYED_REQUEST');
    expect(future.recoverable).toBe(false);

    const replayed = evaluateNavigationBoundary({ pathname: '/create' }, connected, {
      nonce: 'nav-1',
      issuedAt: now,
      now,
      seenNonces: new Set(['nav-1']),
    });
    expect(replayed).toMatchObject({ ok: false, code: 'REPLAYED_REQUEST', recoverable: false });

    const fresh = evaluateNavigationBoundary({ pathname: '/create' }, connected, {
      nonce: 'nav-2',
      issuedAt: now,
      now,
      seenNonces: new Set(['nav-1']),
    });
    expect(fresh.ok).toBe(true);
  });

  it('rejects malformed and owner-mismatched session snapshots', () => {
    expect(validateSessionSnapshot('not-json').code).toBe('MALFORMED_RESPONSE');
    expect(validateSessionSnapshot({ ok: false }).code).toBe('MALFORMED_RESPONSE');
    expect(validateSessionSnapshot({ address: '0xdead' }).code).toBe('MALFORMED_RESPONSE');
    expect(
      validateSessionSnapshot({ address: ADDRESS, networkPassphrase: NETWORK }, OTHER).code,
    ).toBe('TAMPERED_OWNERSHIP');

    const ok = validateSessionSnapshot({
      ok: true,
      address: ADDRESS,
      networkPassphrase: NETWORK,
    });
    expect(ok.ok).toBe(true);
  });

  it('gates protected sidebar targets through canActivateNavItem', () => {
    expect(canActivateNavItem('/create', { connected: false }).code).toBe('DISCONNECTED_WALLET');
    expect(canActivateNavItem('/', { connected: false }).ok).toBe(true);
    expect(canActivateNavItem('/analytics', connected).ok).toBe(true);
  });

  it('treats only G-prefixed 56-character encoded strings as addresses', () => {
    expect(isValidStellarAddress(ADDRESS)).toBe(true);
    expect(isValidStellarAddress('GSHORT')).toBe(false);
    expect(isValidStellarAddress(null)).toBe(false);
  });
});
