import { NextRequest } from 'next/server';
import { verifySessionToken } from './auth';
import { ForbiddenError, UnauthorizedError } from './errors';

const ADMIN_ADDRESSES = new Set(
  process.env.ADMIN_ADDRESSES?.split(',').map((address) => address.trim()).filter(Boolean) ?? [],
);

export interface VerifiedAuth {
  address: string;
  isAdmin: boolean;
}

export interface AuthenticatedRequest extends NextRequest {
  user: {
    address: string;
    csrfToken: string;
  };
}

export function verifyAuth(req: NextRequest): VerifiedAuth {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Bearer token required');
  }

  const token = authHeader.slice(7);
  const session = verifySessionToken(token);

  if (!session.valid || !session.address) {
    throw new UnauthorizedError('Invalid or expired session');
  }

  return {
    address: session.address,
    isAdmin: ADMIN_ADDRESSES.has(session.address),
  };
}

export function requireAdmin(req: NextRequest): VerifiedAuth {
  const auth = verifyAuth(req);

  if (!auth.isAdmin) {
    throw new ForbiddenError('Admin access required');
  }

  return auth;
}

export function requireAuth(req: NextRequest): AuthenticatedRequest {
  const sessionToken = req.cookies.get('session')?.value;

  if (!sessionToken) {
    throw new UnauthorizedError('No session token provided');
  }

  const verification = verifySessionToken(sessionToken);

  if (!verification.valid || !verification.address || !verification.csrfToken) {
    throw new UnauthorizedError(verification.error || 'Invalid session token');
  }

  const authenticatedReq = req as AuthenticatedRequest;
  authenticatedReq.user = {
    address: verification.address,
    csrfToken: verification.csrfToken,
  };

  return authenticatedReq;
}

export function validateCsrfToken(req: NextRequest, expectedCsrfToken: string): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return;
  }

  const providedCsrfToken = req.headers.get('x-csrf-token');

  if (!providedCsrfToken) {
    throw new UnauthorizedError('CSRF token required for state-changing requests');
  }

  if (providedCsrfToken !== expectedCsrfToken) {
    throw new UnauthorizedError('Invalid CSRF token');
  }
}

export function validateOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  const referer = req.headers.get('referer');

  if (!origin && !referer) {
    return;
  }

  if (origin && host) {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      throw new UnauthorizedError('Cross-origin request not allowed');
    }
  }

  if (referer && host && !origin) {
    const refererHost = new URL(referer).host;
    if (refererHost !== host) {
      throw new UnauthorizedError('Cross-origin request not allowed');
    }
  }
}
