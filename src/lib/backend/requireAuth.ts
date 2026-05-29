import { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/backend/auth';
import { UnauthorizedError, ForbiddenError } from '@/lib/backend/errors';

const ADMIN_ADDRESSES = new Set(
    process.env.ADMIN_ADDRESSES?.split(',').map(a => a.trim()).filter(Boolean) ?? []
);

export interface AuthenticatedRequest {
    address: string;
    isAdmin: boolean;
}

export function verifyAuth(req: NextRequest): AuthenticatedRequest {
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

export function requireAdmin(req: NextRequest): AuthenticatedRequest {
    const auth = verifyAuth(req);

    if (!auth.isAdmin) {
        throw new ForbiddenError('Admin access required');
    }

    return auth;
import { verifySessionToken } from './auth';
import { UnauthorizedError } from './errors';

export interface AuthenticatedRequest extends NextRequest {
    user: {
        address: string;
        csrfToken: string;
    };
}

/**
 * Middleware to require authentication for protected routes.
 * Extracts and validates the session token from HTTP-only cookie.
 */
export function requireAuth(req: NextRequest): AuthenticatedRequest {
    // Get session token from HTTP-only cookie
    const sessionToken = req.cookies.get('session')?.value;
    
    if (!sessionToken) {
        throw new UnauthorizedError('No session token provided');
    }
    
    // Verify the session token
    const verification = verifySessionToken(sessionToken);
    
    if (!verification.valid) {
        throw new UnauthorizedError(verification.error || 'Invalid session token');
    }
    
    // Add user info to request object
    const authenticatedReq = req as AuthenticatedRequest;
    authenticatedReq.user = {
        address: verification.address!,
        csrfToken: verification.csrfToken!,
    };
    
    return authenticatedReq;
}

/**
 * Validate CSRF token for state-changing requests.
 * For browser-based requests with cookie authentication.
 */
export function validateCsrfToken(req: NextRequest, expectedCsrfToken: string): void {
    const method = req.method;
    
    // Only validate CSRF for state-changing methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return;
    }
    
    // Get CSRF token from header (preferred) or fallback to body
    const providedCsrfToken = req.headers.get('x-csrf-token');
    
    if (!providedCsrfToken) {
        throw new UnauthorizedError('CSRF token required for state-changing requests');
    }
    
    if (providedCsrfToken !== expectedCsrfToken) {
        throw new UnauthorizedError('Invalid CSRF token');
    }
}

/**
 * Validate Origin header for additional CSRF protection.
 * This is a defense-in-depth measure.
 */
export function validateOrigin(req: NextRequest): void {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    const referer = req.headers.get('referer');
    
    // Skip validation for same-origin requests
    if (!origin && !referer) {
        return;
    }
    
    // Check if origin matches current host (basic same-origin check)
    if (origin && host) {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
            throw new UnauthorizedError('Cross-origin request not allowed');
        }
    }
    
    // Fallback to referer check if origin is not available
    if (referer && host && !origin) {
        const refererHost = new URL(referer).host;
        if (refererHost !== host) {
            throw new UnauthorizedError('Cross-origin request not allowed');
        }
    }
}
