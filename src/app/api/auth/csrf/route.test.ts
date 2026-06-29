import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import {
  SESSION_COOKIE_NAME,
  createBrowserSession,
  __resetSessionStoreForTests,
} from '@/lib/backend/session';

const makeRequest = (cookie?: string) =>
  new NextRequest('http://localhost:3000/api/auth/csrf', {
    method: 'GET',
    headers: cookie ? { cookie } : {},
  });

describe('GET /api/auth/csrf', () => {
  beforeEach(() => {
    __resetSessionStoreForTests();
  });

  it('issues the session CSRF token for an authenticated session', async () => {
    const { sessionId, csrfToken } = createBrowserSession('GABC');

    const res = await GET(
      makeRequest(`${SESSION_COOKIE_NAME}=${sessionId}`),
      { params: {} },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.csrfToken).toBe(csrfToken);
  });

  it('returns 401 when no session cookie is present', async () => {
    const res = await GET(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('returns 401 when the session cookie references an unknown session', async () => {
    const res = await GET(
      makeRequest(`${SESSION_COOKIE_NAME}=does-not-exist`),
      { params: {} },
    );

    expect(res.status).toBe(401);
  });
});
