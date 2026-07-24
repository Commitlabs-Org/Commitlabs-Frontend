import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateNonce,
  createSessionToken,
  verifySessionToken,
  revokeSession,
  _clearStores,
  generateChallengeMessage,
  verifyStellarSignature,
} from '../auth';

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

  it('includes IssuedAt and ExpiresAt timestamps', () => {
    const nonce = generateNonce();
    const msg = generateChallengeMessage(nonce);
    expect(msg).toMatch(/IssuedAt: \d{4}-\d{2}-\d{2}T/);
    expect(msg).toMatch(/ExpiresAt: \d{4}-\d{2}-\d{2}T/);
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
