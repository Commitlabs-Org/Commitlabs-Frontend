import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateNonce,
  createSessionToken,
  verifySessionToken,
  revokeSession,
  _clearStores,
  generateChallengeMessage,
  verifyStellarSignature,
  verifySignatureWithNonce,
  getDefaultDomain,
  _resetDomainCache,
} from '../auth';

// Each test starts from a clean env so domain resolution is deterministic
// regardless of any stray CI / developer env vars. We stub every
// DOMAIN_ENV_KEYS entry to '' (rather than unsetting) so the helper's `!raw`
// check exercises the same code path as a real unset variable.
const DOMAIN_ENV_KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_APP_URL',
  'SITE_URL',
  'APP_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
] as const;

beforeEach(() => {
  _resetDomainCache();
  for (const key of DOMAIN_ENV_KEYS) {
    vi.stubEnv(key, '');
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  _resetDomainCache();
});

describe('generateNonce', () => {
  it('returns a 32-character hex string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns a unique value on each call', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});

describe('session token helpers', () => {
  beforeEach(() => {
    _clearStores();
  });

  afterEach(() => {
    _clearStores();
  });

  describe('createSessionToken', () => {
    it('returns a token string prefixed with "session_"', () => {
      const token = createSessionToken('GABC123');
      expect(token).toMatch(/^session_[0-9a-f]{32}$/);
    });

    it('returns a unique token on each call', () => {
      const a = createSessionToken('GABC123');
      const b = createSessionToken('GABC123');
      expect(a).not.toBe(b);
    });
  });

  describe('verifySessionToken', () => {
    it('returns valid=true with address and csrfToken for a fresh token', () => {
      const address = 'GABC_VALID_ADDRESS';
      const token = createSessionToken(address);
      const result = verifySessionToken(token);

      expect(result.valid).toBe(true);
      expect(result.address).toBe(address);
      expect(result.csrfToken).toBeTruthy();
    });

    it('returns valid=false for an unknown token', () => {
      const result = verifySessionToken('session_nonexistent0000000000000000');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('returns valid=false and deletes the record for an expired token', () => {
      vi.useFakeTimers();
      const token = createSessionToken('GEXPIRE');

      // Advance time past 24h SESSION_TTL
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const result = verifySessionToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session expired');

      // Confirm the expired session was cleaned up
      const second = verifySessionToken(token);
      expect(second.valid).toBe(false);
      expect(second.error).toBe('Session not found');

      vi.useRealTimers();
    });

    it('does not expire a token before the TTL elapses', () => {
      vi.useFakeTimers();
      const token = createSessionToken('GSTILL_VALID');

      vi.advanceTimersByTime(23 * 60 * 60 * 1000);

      const result = verifySessionToken(token);
      expect(result.valid).toBe(true);

      vi.useRealTimers();
    });

    it('returns valid=false for an empty string token', () => {
      const result = verifySessionToken('');
      expect(result.valid).toBe(false);
    });

    it('rejects a token with a tampered payload (wrong prefix)', () => {
      const token = createSessionToken('GTAMPERED');
      const tampered = token.replace('session_', 'tampered_');
      const result = verifySessionToken(tampered);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session not found');
    });
  });

  describe('revokeSession', () => {
    it('returns true when revoking an existing session', () => {
      const token = createSessionToken('GREVOKE');
      expect(revokeSession(token)).toBe(true);
    });

    it('returns false when revoking a non-existent session', () => {
      expect(revokeSession('session_doesnotexist00000000000000')).toBe(false);
    });

    it('makes the token invalid after revocation', () => {
      const token = createSessionToken('GREVOKE2');
      revokeSession(token);
      const result = verifySessionToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session not found');
    });
  });
});

describe('generateChallengeMessage', () => {
  it('produces a V2 message containing the nonce', () => {
    const nonce = generateNonce();
    const msg = generateChallengeMessage(nonce);
    expect(msg).toContain('[CommitLabs Auth V2]');
    expect(msg).toContain(`Nonce: ${nonce}`);
    expect(msg).toContain('Domain: commitlabs.org');
  });

  it('accepts a custom domain', () => {
    const nonce = generateNonce();
    const msg = generateChallengeMessage(nonce, 'example.com');
    expect(msg).toContain('Domain: example.com');
  });

  it('takes its default domain from NEXT_PUBLIC_SITE_URL when set', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.commitlabs.org');
    const nonce = generateNonce();
    const msg = generateChallengeMessage(nonce);
    expect(msg).toContain('Domain: staging.commitlabs.org');
    expect(msg).not.toContain('Domain: commitlabs.org');
  });

  it('takes its default domain from NEXT_PUBLIC_APP_URL when NEXT_PUBLIC_SITE_URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    const nonce = generateNonce();
    const msg = generateChallengeMessage(nonce);
    expect(msg).toContain('Domain: localhost');
  });

  it('falls back to a hardcoded domain when no env vars are set', () => {
    const nonce = generateNonce();
    const msg = generateChallengeMessage(nonce);
    expect(msg).toContain('Domain: commitlabs.org');
  });

  it('includes IssuedAt and ExpiresAt timestamps', () => {
    const nonce = generateNonce();
    const msg = generateChallengeMessage(nonce);
    expect(msg).toMatch(/IssuedAt: \d{4}-\d{2}-\d{2}T/);
    expect(msg).toMatch(/ExpiresAt: \d{4}-\d{2}-\d{2}T/);
  });
});

describe('getDefaultDomain', () => {
  it('returns "commitlabs.org" when no domain env vars are set', () => {
    expect(getDefaultDomain()).toBe('commitlabs.org');
  });

  it('prefers NEXT_PUBLIC_SITE_URL over other env vars', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.commitlabs.org');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.staging.commitlabs.org');
    vi.stubEnv('VERCEL_URL', 'preview-abc.vercel.app');
    expect(getDefaultDomain()).toBe('staging.commitlabs.org');
  });

  it('falls back to NEXT_PUBLIC_APP_URL when NEXT_PUBLIC_SITE_URL is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.commitlabs.org/foo');
    expect(getDefaultDomain()).toBe('app.commitlabs.org');
  });

  it('falls back to VERCEL_URL when no SITE_URL or APP_URL env vars are set', () => {
    vi.stubEnv('VERCEL_URL', 'commitlabs-pr-123.vercel.app');
    expect(getDefaultDomain()).toBe('commitlabs-pr-123.vercel.app');
  });

  it('falls back to VERCEL_PROJECT_PRODUCTION_URL when other vars are missing', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'commitlabs.org');
    expect(getDefaultDomain()).toBe('commitlabs.org');
  });

  it('extracts hostname from URLs with ports', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    expect(getDefaultDomain()).toBe('localhost');
  });

  it('extracts hostname from URLs with paths', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.commitlabs.org/some/path');
    expect(getDefaultDomain()).toBe('app.commitlabs.org');
  });

  it('handles raw host strings without a protocol', () => {
    vi.stubEnv('VERCEL_URL', 'preview-without-protocol.vercel.app');
    expect(getDefaultDomain()).toBe('preview-without-protocol.vercel.app');
  });

  it('skips malformed env values and continues down the chain', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'not a url with spaces');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.commitlabs.org');
    expect(getDefaultDomain()).toBe('app.commitlabs.org');
  });

  it('skips all malformed env values and returns the hardcoded fallback', () => {
    // Each env value is selected so the WHATWG URL parser reliably throws
    // (unclosed brackets, invalid port, parens in a special scheme authority)
    // or the resulting hostname is rejected by the regex guard.
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://[invalid');        // throws (unclosed '[')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://[');                // throws (empty authority + unclosed '[')
    vi.stubEnv('SITE_URL', 'http://example.com:zzz');            // throws (port must be a uint16)
    vi.stubEnv('APP_URL', 'http://(badparens)');                  // throws (parens are forbidden in URL-special host)
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'http://[x');     // throws (unclosed '[')
    vi.stubEnv('VERCEL_URL', '!!!');                              // hostname '!!!' rejected by regex
    expect(getDefaultDomain()).toBe('commitlabs.org');
  });

  it('caches the resolved domain across calls', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://first.commitlabs.org');
    expect(getDefaultDomain()).toBe('first.commitlabs.org');
    // Change env after the first resolved call; cache should still return the
    // first value (the auth flow re-resolves only on cache reset).
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://second.commitlabs.org');
    expect(getDefaultDomain()).toBe('first.commitlabs.org');
  });

  it('_resetDomainCache forces a re-resolve against the current env', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://first.commitlabs.org');
    expect(getDefaultDomain()).toBe('first.commitlabs.org');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://second.commitlabs.org');
    _resetDomainCache();
    expect(getDefaultDomain()).toBe('second.commitlabs.org');
  });
});

describe('generate/verify domain agreement (issue #1289)', () => {
  it('accepts a V2 challenge whose Domain: field matches the env-driven default', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.commitlabs.org');
    const nonce = generateNonce();
    const message = generateChallengeMessage(nonce);

    const result = await verifySignatureWithNonce({
      address: 'GABC',
      signature: 'sig',
      message,
    });

    // The verifier should pass the domain check and fail later (no nonce in
    // KV rather than a domain mismatch) — proving generate and verify agree
    // on the env-driven domain.
    expect(result.valid).toBe(false);
    expect(result.error).not.toBe('Domain mismatch');
    expect(result.error).toBe('Invalid or expired nonce');
  });

  it('rejects a V2 challenge whose Domain: field does not match the env-driven default', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.commitlabs.org');
    const nonce = generateNonce();
    // Caller overrides with an attacker-controlled domain.
    const message = generateChallengeMessage(nonce, 'attacker.example.com');

    const result = await verifySignatureWithNonce({
      address: 'GABC',
      signature: 'sig',
      message,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Domain mismatch');
  });

  it('accepts a V2 challenge with the hardcoded fallback when no env is set', async () => {
    const nonce = generateNonce();
    const message = generateChallengeMessage(nonce);

    const result = await verifySignatureWithNonce({
      address: 'GABC',
      signature: 'sig',
      message,
    });

    expect(result.valid).toBe(false);
    expect(result.error).not.toBe('Domain mismatch');
    expect(result.error).toBe('Invalid or expired nonce');
  });
});

describe('verifyStellarSignature', () => {
  it('returns valid=false with error when address is missing', () => {
    const result = verifyStellarSignature('', 'sig', 'message');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required fields');
  });

  it('returns valid=false with error when signature is missing', () => {
    const result = verifyStellarSignature('GABC', '', 'message');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required fields');
  });

  it('returns valid=false with error when message is missing', () => {
    const result = verifyStellarSignature('GABC', 'sig', '');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required fields');
  });

  it('returns valid=false for an invalid Stellar address', () => {
    const result = verifyStellarSignature('INVALID_ADDRESS', 'sig', 'message');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid Stellar address');
  });

  it('does not throw for malformed input combinations', () => {
    expect(() => verifyStellarSignature('', '', '')).not.toThrow();
    expect(() => verifyStellarSignature('x'.repeat(200), '!!!', '\x00\x01')).not.toThrow();
  });
});
