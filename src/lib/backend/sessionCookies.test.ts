import { describe, it, expect, afterEach } from 'vitest';
import { NextResponse } from 'next/server';
import { applySessionCookie, clearSessionCookie } from './sessionCookies';
import { SESSION_COOKIE_NAME } from './session';

describe('sessionCookies', () => {
  afterEach(() => {
    delete process.env.SESSION_COOKIE_MAX_AGE_SECONDS;
  });

  it('applySessionCookie sets cl_session on the response', () => {
    const res = NextResponse.json({ ok: true });
    applySessionCookie(res, 'sess_test_value');
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe('sess_test_value');
  });

  it('applySessionCookie defaults maxAge to one week when SESSION_COOKIE_MAX_AGE_SECONDS is unset', () => {
    const ONE_WEEK_SEC = 60 * 60 * 24 * 7;
    const res = NextResponse.json({ ok: true });
    applySessionCookie(res, 'sess_default');
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(ONE_WEEK_SEC);
  });

  it('applySessionCookie reads maxAge from SESSION_COOKIE_MAX_AGE_SECONDS env var', () => {
    process.env.SESSION_COOKIE_MAX_AGE_SECONDS = '3600';
    const res = NextResponse.json({ ok: true });
    applySessionCookie(res, 'sess_env_override');
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(3600);
  });

  it('applySessionCookie falls back to one week for non-positive SESSION_COOKIE_MAX_AGE_SECONDS', () => {
    const ONE_WEEK_SEC = 60 * 60 * 24 * 7;
    process.env.SESSION_COOKIE_MAX_AGE_SECONDS = '0';
    const res = NextResponse.json({ ok: true });
    applySessionCookie(res, 'sess_bad_value');
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(ONE_WEEK_SEC);
  });

  it('clearSessionCookie clears cl_session', () => {
    const res = NextResponse.json({ ok: true });
    applySessionCookie(res, 'x');
    clearSessionCookie(res);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe('');
  });
});
