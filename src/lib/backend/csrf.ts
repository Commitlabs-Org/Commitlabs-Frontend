import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { CsrfValidationError } from './errors';
import { getSessionRecord, readSessionIdFromRequest } from './session';

export const CSRF_HEADER_NAME = 'x-csrf-token';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hasBearerAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  return Boolean(auth && /^Bearer\s+\S+/i.test(auth.trim()));
}

function getRequestOrigin(req: NextRequest): string {
  return new URL(req.url).origin;
}

/**
 * Same-site defense: require Origin or Referer to match this deployment origin.
 * Skipped when no browser session cookie is present (see assertMutationCsrf).
 */
export function assertSameOriginForCookieSession(req: NextRequest): void {
  const expected = getRequestOrigin(req);
  const origin = req.headers.get('origin');
  if (origin) {
    if (origin !== expected) {
      throw new CsrfValidationError('Cross-origin request rejected.', {
        reason: 'origin_mismatch',
        expected,
        origin,
      });
    }
    return;
  }
  const referer = req.headers.get('referer');
  if (referer) {
    if (!referer.startsWith(`${expected}/`) && referer !== expected) {
      throw new CsrfValidationError('Cross-site request rejected.', {
        reason: 'referer_mismatch',
        expected,
      });
    }
    return;
  }
  throw new CsrfValidationError('Missing Origin or Referer for cookie-authenticated mutation.', {
    reason: 'missing_origin',
  });
}

function safeEqualToken(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Enforces synchronizer CSRF (header `x-csrf-token` vs server session) plus origin checks
 * when a `cl_session` cookie is present. API clients using `Authorization: Bearer` skip CSRF.
 * Requests without a session cookie are unchanged (no CSRF requirement).
 */
export function assertMutationCsrf(req: NextRequest): void {
  const method = req.method.toUpperCase();
  if (!MUTATION_METHODS.has(method)) return;

  if (hasBearerAuth(req)) return;

  const sessionId = readSessionIdFromRequest(req.cookies);
  if (!sessionId) return;

  assertSameOriginForCookieSession(req);

  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new CsrfValidationError('Session is invalid or expired.', { reason: 'unknown_session' });
  }

  const headerToken = req.headers.get(CSRF_HEADER_NAME)?.trim() ?? '';
  if (!headerToken) {
    throw new CsrfValidationError('Missing CSRF token.', { reason: 'missing_header' });
  }

  if (!safeEqualToken(headerToken, record.csrfToken)) {
    throw new CsrfValidationError('Invalid CSRF token.', { reason: 'token_mismatch' });
  }
}
