import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  COOKIE_OPTIONS,
  _clearStores,
  createSessionToken,
  verifySessionToken,
  revokeSession,
  generateNonce,
  getNonceRecord,
  consumeNonce,
  listOtherSessions,
  revokeOtherSessions,
} from './auth';

describe('auth module', () => {
  beforeEach(() => {
    _clearStores();
  });

  describe('AUTH_COOKIE_NAME', () => {
    it('is defined as a string', () => {
      expect(typeof AUTH_COOKIE_NAME).toBe('string');
      expect(AUTH_COOKIE_NAME.length).toBeGreaterThan(0);
    });
  });

  describe('COOKIE_OPTIONS', () => {
    it('includes required cookie flags', () => {
      expect(COOKIE_OPTIONS.httpOnly).toBe(true);
      expect(COOKIE_OPTIONS.sameSite).toBe('lax');
      expect(COOKIE_OPTIONS.path).toBe('/');
      expect(COOKIE_OPTIONS.maxAge).toBeGreaterThan(0);
    });
  });

  describe('createSessionToken / verifySessionToken', () => {
    it('creates a valid session token for an address', () => {
      const token = createSessionToken('GABCDEF123');
      const result = verifySessionToken(token);
      expect(result.valid).toBe(true);
      expect(result.address).toBe('GABCDEF123');
    });

    it('returns invalid for a bogus token', () => {
      const result = verifySessionToken('bogus-token');
      expect(result.valid).toBe(false);
      expect(result.address).toBeUndefined();
    });

    it('returns invalid for an empty token', () => {
      const result = verifySessionToken('');
      expect(result.valid).toBe(false);
    });

    it('returns invalid for a token that was revoked', () => {
      const token = createSessionToken('GABCDEF123');
      revokeSession(token);
      const result = verifySessionToken(token);
      expect(result.valid).toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('revokes an active session', () => {
      const token = createSessionToken('GABCDEF123');
      expect(revokeSession(token)).toBe(true);
      expect(verifySessionToken(token).valid).toBe(false);
    });

    it('returns false for an already-revoked token', () => {
      const token = createSessionToken('GABCDEF123');
      revokeSession(token);
      expect(revokeSession(token)).toBe(false);
    });

    it('returns false for a token that never existed', () => {
      expect(revokeSession('session_nonexistent_1234567890_abcdef')).toBe(false);
    });
  });

  describe('generateNonce / getNonceRecord / consumeNonce', () => {
    it('generates a nonce for an address', () => {
      const { nonce, message } = generateNonce('GABCDEF123');
      expect(nonce).toBeTruthy();
      expect(message).toContain('GABCDEF123');
      expect(message).toContain(nonce);
    });

    it('stores and retrieves a nonce record', () => {
      const { nonce, message } = generateNonce('GABCDEF123');
      const record = getNonceRecord(nonce);
      expect(record).toBeDefined();
      expect(record!.address).toBe('GABCDEF123');
      expect(record!.message).toBe(message);
      expect(record!.consumed).toBe(false);
    });

    it('returns undefined for an unknown nonce', () => {
      expect(getNonceRecord('unknown')).toBeUndefined();
    });

    it('consumeNonce marks the nonce as consumed', () => {
      const { nonce } = generateNonce('GABCDEF123');
      expect(consumeNonce(nonce)).toBe(true);
      expect(consumeNonce(nonce)).toBe(false);
    });

    it('consumeNonce returns false for an unknown nonce', () => {
      expect(consumeNonce('unknown')).toBe(false);
    });
  });

  describe('listOtherSessions', () => {
    it('returns an empty list when only the current session exists', () => {
      const token = createSessionToken('GABCDEF123');
      const others = listOtherSessions(token);
      expect(others).toHaveLength(0);
    });

    it('excludes the current session', () => {
      const token = createSessionToken('GABCDEF123');
      createSessionToken('GOTHER456');
      const others = listOtherSessions(token);
      expect(others).toHaveLength(1);
      expect(others[0]!.address).toBe('GOTHER456');
      expect(others[0]!.current).toBe(false);
    });
  });

  describe('revokeOtherSessions', () => {
    it('revokes all sessions except the current one', () => {
      const token = createSessionToken('GABCDEF123');
      createSessionToken('GOTHER456');
      createSessionToken('GANOTHER789');
      const count = revokeOtherSessions(token);
      expect(count).toBe(2);
      expect(verifySessionToken(token).valid).toBe(true);
    });
  });
});

async function loadLogoutRoute() {
  return await import('../../app/api/auth/logout/route');
}

async function loadSessionsRoute() {
  return await import('../../app/api/auth/sessions/route');
}

async function loadRevokeOthersRoute() {
  return await import('../../app/api/auth/sessions/revoke-others/route');
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    _clearStores();
  });

  it('clears the auth cookie on logout', async () => {
    const { POST } = await loadLogoutRoute();
    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(AUTH_COOKIE_NAME);
    expect(cookie?.value).toBe('');
    expect(cookie?.maxAge).toBe(0);
  });

  it('revokes the session token when provided', async () => {
    const token = createSessionToken('GABCDEF123');
    const { POST } = await loadLogoutRoute();
    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(verifySessionToken(token).valid).toBe(false);
  });

  it('succeeds even without an authorization header', async () => {
    const { POST } = await loadLogoutRoute();
    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/auth/sessions', () => {
  beforeEach(() => {
    _clearStores();
  });

  it('returns session list for authenticated user', async () => {
    const token = createSessionToken('GABCDEF123');
    createSessionToken('GOTHER456');
    const { GET } = await loadSessionsRoute();
    const req = new NextRequest('http://localhost:3000/api/auth/sessions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]!.address).toBe('GOTHER456');
  });

  it('returns 401 without authorization header', async () => {
    const { GET } = await loadSessionsRoute();
    const req = new NextRequest('http://localhost:3000/api/auth/sessions');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/sessions/revoke-others', () => {
  beforeEach(() => {
    _clearStores();
  });

  it('revokes other sessions', async () => {
    const token = createSessionToken('GABCDEF123');
    const token2 = createSessionToken('GABCDEF123');
    const { POST } = await loadRevokeOthersRoute();
    const req = new NextRequest('http://localhost:3000/api/auth/sessions/revoke-others', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revoked).toBe(1);
    expect(verifySessionToken(token).valid).toBe(true);
    expect(verifySessionToken(token2).valid).toBe(false);
  });

  it('returns 401 without authorization header', async () => {
    const { POST } = await loadRevokeOthersRoute();
    const req = new NextRequest('http://localhost:3000/api/auth/sessions/revoke-others', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
