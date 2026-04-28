import type { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from './session';

const ONE_WEEK_SEC = 60 * 60 * 24 * 7;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Cookie flags for browser session: HttpOnly, SameSite=Lax, Secure in production.
 */
export function applySessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: ONE_WEEK_SEC,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: 0,
  });
}
