import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/auth', () => ({
  AUTH_COOKIE_NAME: 'cl_auth_session',
  verifySessionToken: vi.fn(),
}));

const AUTH_COOKIE_NAME = 'cl_auth_session';

import { GET } from './route';
import { verifySessionToken } from '@/lib/backend/auth';

const makeRequest = (cookie?: string) =>
  new NextRequest('http://localhost:3000/api/auth/session', {
    headers: cookie ? { cookie } : {},
  });

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports unauthenticated when no session cookie is present', async () => {
    const res = await GET(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.authenticated).toBe(false);
    expect(body.data.address).toBeUndefined();
    expect(verifySessionToken).not.toHaveBeenCalled();
  });

  it('reports unauthenticated when the session token is invalid or expired', async () => {
    vi.mocked(verifySessionToken).mockReturnValue({ valid: false, error: 'Session expired' });

    const res = await GET(makeRequest(`${AUTH_COOKIE_NAME}=stale-token`), { params: {} });
    const body = await res.json();

    expect(body.data.authenticated).toBe(false);
    expect(body.data.address).toBeUndefined();
  });

  it('reports the authenticated address without ever echoing the token back', async () => {
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: 'GABC' });

    const res = await GET(makeRequest(`${AUTH_COOKIE_NAME}=valid-token`), { params: {} });
    const body = await res.json();

    expect(body.data.authenticated).toBe(true);
    expect(body.data.address).toBe('GABC');
    expect(JSON.stringify(body)).not.toContain('valid-token');
  });
});
