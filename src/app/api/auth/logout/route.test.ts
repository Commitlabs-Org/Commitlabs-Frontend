import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'cl_auth';

// The route imports cookie constants and revokeSession from the auth module.
// We mock it so the test asserts the route's behaviour at the boundary.
vi.mock('@/lib/backend/auth', () => ({
  AUTH_COOKIE_NAME,
  COOKIE_OPTIONS: {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
  },
  revokeSession: vi.fn(),
}));

import { POST } from './route';
import { revokeSession } from '@/lib/backend/auth';

const makeRequest = (cookie?: string) =>
  new NextRequest('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: cookie ? { cookie } : {},
  });

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes the session and clears the cookie when a session exists', async () => {
    const res = await POST(makeRequest(`${AUTH_COOKIE_NAME}=token-123`), {
      params: {},
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(revokeSession).toHaveBeenCalledWith('token-123');

    // The cookie is cleared: empty value with an expiry in the past.
    const cleared = res.cookies.get(AUTH_COOKIE_NAME);
    expect(cleared?.value).toBe('');
    expect(cleared?.expires?.getTime()).toBe(0);
  });

  it('is idempotent and succeeds when no session cookie is present', async () => {
    const res = await POST(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // No token means nothing to revoke.
    expect(revokeSession).not.toHaveBeenCalled();
    // Still clears the cookie defensively.
    expect(res.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('');
  });

  it('does not throw when called twice (double logout)', async () => {
    await POST(makeRequest(`${AUTH_COOKIE_NAME}=token-123`), { params: {} });
    const res = await POST(makeRequest(`${AUTH_COOKIE_NAME}=token-123`), {
      params: {},
    });

    expect(res.status).toBe(200);
    expect(revokeSession).toHaveBeenCalledTimes(2);
  });
});
