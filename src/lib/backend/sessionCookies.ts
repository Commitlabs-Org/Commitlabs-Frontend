import type { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from './session';

const ONE_WEEK_SEC = 60 * 60 * 24 * 7;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function sessionCookieMaxAge(): number {
  return envInt('SESSION_COOKIE_MAX_AGE_SECONDS', ONE_WEEK_SEC);
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
    maxAge: sessionCookieMaxAge(),
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
