import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { assertMutationCsrf, assertSameOriginForCookieSession, CSRF_HEADER_NAME } from './csrf';
import { CsrfValidationError } from './errors';
import { __resetSessionStoreForTests, createBrowserSession, SESSION_COOKIE_NAME } from './session';

const BASE = 'http://localhost:3000';

function req(
  method: string,
  opts: { cookie?: string; origin?: string; referer?: string; csrf?: string; bearer?: string } = {},
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.origin) headers.Origin = opts.origin;
  if (opts.referer) headers.Referer = opts.referer;
  if (opts.csrf) headers[CSRF_HEADER_NAME] = opts.csrf;
  if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;
  return new NextRequest(`${BASE}/api/example`, { method, headers });
}

describe('assertMutationCsrf', () => {
  beforeEach(() => {
    __resetSessionStoreForTests();
  });

  it('does not enforce when no session cookie is present', () => {
    expect(() => assertMutationCsrf(req('POST', { origin: BASE }))).not.toThrow();
  });

  it('skips enforcement for Authorization Bearer (API clients)', () => {
    const { sessionId } = createBrowserSession();
    expect(() =>
      assertMutationCsrf(
        req('POST', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
          origin: BASE,
          bearer: 'api-token',
          csrf: 'wrong',
        }),
      ),
    ).not.toThrow();
  });

  it('throws CSRF_INVALID when Origin does not match', () => {
    const { sessionId, csrfToken: validCsrf } = createBrowserSession();
    expect(() =>
      assertMutationCsrf(
        req('POST', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
          origin: 'https://evil.example',
          csrf: validCsrf,
        }),
      ),
    ).toThrow(CsrfValidationError);
  });

  it('throws when session cookie present but CSRF header missing', () => {
    const { sessionId } = createBrowserSession();
    expect(() =>
      assertMutationCsrf(
        req('POST', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
          origin: BASE,
        }),
      ),
    ).toThrow(CsrfValidationError);
  });

  it('throws when CSRF token does not match session', () => {
    const { sessionId } = createBrowserSession();
    expect(() =>
      assertMutationCsrf(
        req('POST', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
          origin: BASE,
          csrf: 'deadbeef',
        }),
      ),
    ).toThrow(CsrfValidationError);
  });

  it('allows mutation when Origin and CSRF token match session', () => {
    const { sessionId, csrfToken } = createBrowserSession();
    expect(() =>
      assertMutationCsrf(
        req('POST', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
          origin: BASE,
          csrf: csrfToken,
        }),
      ),
    ).not.toThrow();
  });

  it('allows mutation when Referer matches instead of Origin', () => {
    const { sessionId, csrfToken } = createBrowserSession();
    expect(() =>
      assertMutationCsrf(
        req('POST', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
          referer: `${BASE}/dashboard`,
          csrf: csrfToken,
        }),
      ),
    ).not.toThrow();
  });

  it('allows mutation when Referer equals request origin exactly', () => {
    const { sessionId, csrfToken } = createBrowserSession();
    expect(() =>
      assertMutationCsrf(
        req('POST', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
          referer: BASE,
          csrf: csrfToken,
        }),
      ),
    ).not.toThrow();
  });

  it('throws when session cookie does not map to a server session', () => {
    expect(() =>
      assertMutationCsrf(
        req('POST', {
          cookie: `${SESSION_COOKIE_NAME}=not_in_store`,
          origin: BASE,
          csrf: 'any',
        }),
      ),
    ).toThrow(CsrfValidationError);
  });

  it('throws when Referer is present but does not match expected origin', () => {
    const { sessionId, csrfToken } = createBrowserSession();
    expect(() =>
      assertMutationCsrf(
        req('POST', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
          referer: 'https://evil.example/page',
          csrf: csrfToken,
        }),
      ),
    ).toThrow(CsrfValidationError);
  });

  it('ignores GET requests', () => {
    const { sessionId } = createBrowserSession();
    expect(() =>
      assertMutationCsrf(
        req('GET', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        }),
      ),
    ).not.toThrow();
  });
});

describe('assertSameOriginForCookieSession', () => {
  it('rejects when Origin and Referer are both missing', () => {
    expect(() => assertSameOriginForCookieSession(req('POST', {}))).toThrow(CsrfValidationError);
  });
});
