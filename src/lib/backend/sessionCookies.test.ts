import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import { applySessionCookie, clearSessionCookie } from './sessionCookies';
import { SESSION_COOKIE_NAME } from './session';

describe('sessionCookies', () => {
  it('applySessionCookie sets cl_session on the response', () => {
    const res = NextResponse.json({ ok: true });
    applySessionCookie(res, 'sess_test_value');
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe('sess_test_value');
  });

  it('clearSessionCookie clears cl_session', () => {
    const res = NextResponse.json({ ok: true });
    applySessionCookie(res, 'x');
    clearSessionCookie(res);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe('');
  });
});
