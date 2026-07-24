import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { UnauthorizedError, ForbiddenError } from '../errors';

// Mock the auth module so we control verifySessionToken's behaviour without
// touching the real in-memory session store.
vi.mock('../auth', () => ({
  verifySessionToken: vi.fn(),
}));

import { verifySessionToken } from '../auth';
import { requireAuth, verifyAuth, requireAdmin } from '../requireAuth';

const mockVerify = verifySessionToken as ReturnType<typeof vi.fn>;

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRequestWithCookie(sessionValue: string | null): NextRequest {
  const headers: HeadersInit = sessionValue
    ? { Cookie: `session=${sessionValue}` }
    : {};
  return new NextRequest('http://localhost:3000/api/test', { headers });
}

function makeRequestWithBearer(token: string | null): NextRequest {
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  return new NextRequest('http://localhost:3000/api/test', { headers });
}

// ─── requireAuth ────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws UnauthorizedError when no session cookie is present', () => {
    const req = makeRequestWithCookie(null);
    expect(() => requireAuth(req)).toThrow(UnauthorizedError);
    expect(() => requireAuth(req)).toThrow('No session token provided');
  });

  it('throws UnauthorizedError when verifySessionToken returns invalid', () => {
    mockVerify.mockReturnValue({ valid: false, error: 'Session not found' });
    const req = makeRequestWithCookie('bad-token');
    expect(() => requireAuth(req)).toThrow(UnauthorizedError);
    expect(() => requireAuth(req)).toThrow('Session not found');
  });

  it('throws UnauthorizedError when session lacks address', () => {
    mockVerify.mockReturnValue({ valid: true, address: undefined, csrfToken: 'csrf-abc' });
    const req = makeRequestWithCookie('incomplete-token');
    expect(() => requireAuth(req)).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when session lacks csrfToken', () => {
    mockVerify.mockReturnValue({ valid: true, address: 'GADDR1', csrfToken: undefined });
    const req = makeRequestWithCookie('incomplete-token');
    expect(() => requireAuth(req)).toThrow(UnauthorizedError);
  });

  it('returns an AuthenticatedRequest with user when session is valid', () => {
    mockVerify.mockReturnValue({
      valid: true,
      address: 'GADDR_VALID',
      csrfToken: 'csrf-token-123',
    });
    const req = makeRequestWithCookie('valid-session-token');
    const authed = requireAuth(req);

    expect(authed.user.address).toBe('GADDR_VALID');
    expect(authed.user.csrfToken).toBe('csrf-token-123');
  });
});

// ─── verifyAuth (Bearer-token path) ──────────────────────────────────────────

describe('verifyAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it('throws UnauthorizedError when Authorization header is absent', () => {
    const req = makeRequestWithBearer(null);
    expect(() => verifyAuth(req)).toThrow(UnauthorizedError);
    expect(() => verifyAuth(req)).toThrow('Bearer token required');
  });

  it('throws UnauthorizedError for a non-Bearer Authorization scheme', () => {
    const req = new NextRequest('http://localhost:3000/', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(() => verifyAuth(req)).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when token verification fails', () => {
    mockVerify.mockReturnValue({ valid: false, error: 'Invalid or expired session' });
    const req = makeRequestWithBearer('expired-token');
    expect(() => verifyAuth(req)).toThrow(UnauthorizedError);
    expect(() => verifyAuth(req)).toThrow('Invalid or expired session');
  });

  it('returns VerifiedAuth with isAdmin false for a regular user', () => {
    vi.stubEnv('ADMIN_ADDRESSES', 'GADMIN1,GADMIN2');
    mockVerify.mockReturnValue({ valid: true, address: 'GNORMAL_USER' });
    const req = makeRequestWithBearer('valid-token');
    const result = verifyAuth(req);

    expect(result.address).toBe('GNORMAL_USER');
    expect(result.isAdmin).toBe(false);
  });

  it('returns isAdmin true when address is in ADMIN_ADDRESSES', () => {
    vi.stubEnv('ADMIN_ADDRESSES', 'GADMIN1,GADMIN2');
    mockVerify.mockReturnValue({ valid: true, address: 'GADMIN1' });
    const req = makeRequestWithBearer('admin-token');
    const result = verifyAuth(req);

    expect(result.address).toBe('GADMIN1');
    expect(result.isAdmin).toBe(true);
  });

  it('treats admin detection as case-sensitive (no false positives)', () => {
    vi.stubEnv('ADMIN_ADDRESSES', 'GADMIN1');
    mockVerify.mockReturnValue({ valid: true, address: 'gadmin1' });
    const req = makeRequestWithBearer('lowercase-token');
    const result = verifyAuth(req);

    expect(result.isAdmin).toBe(false);
  });
});

// ─── requireAdmin ─────────────────────────────────────────────────────────────

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it('throws ForbiddenError when the caller is authenticated but not an admin', () => {
    vi.stubEnv('ADMIN_ADDRESSES', 'GADMIN1');
    mockVerify.mockReturnValue({ valid: true, address: 'GNORMAL_USER' });
    const req = makeRequestWithBearer('normal-token');
    expect(() => requireAdmin(req)).toThrow(ForbiddenError);
    expect(() => requireAdmin(req)).toThrow('Admin access required');
  });

  it('returns VerifiedAuth when the caller is an admin', () => {
    vi.stubEnv('ADMIN_ADDRESSES', 'GADMIN1');
    mockVerify.mockReturnValue({ valid: true, address: 'GADMIN1' });
    const req = makeRequestWithBearer('admin-token');
    const result = requireAdmin(req);

    expect(result.address).toBe('GADMIN1');
    expect(result.isAdmin).toBe(true);
  });

  it('throws UnauthorizedError (not ForbiddenError) when no token is provided', () => {
    const req = makeRequestWithBearer(null);
    expect(() => requireAdmin(req)).toThrow(UnauthorizedError);
  });
});
