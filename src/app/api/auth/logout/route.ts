import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { AUTH_COOKIE_NAME, COOKIE_OPTIONS, revokeSession } from '@/lib/backend/auth';

/**
 * Handle POST /api/auth/logout
 * 
 * Clears the session cookie and revokes the session in the backend store.
 * This endpoint is idempotent; calling it multiple times will still return 200.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
    // 1. Get the session token from cookies
    const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME);
    const token = sessionCookie?.value;

    // 2. Revoke the session if token exists
    if (token) {
        revokeSession(token);
    }

    // 3. Prepare response
    const response = ok({
        message: 'Logged out successfully',
    });

    // 4. Clear the session cookie
    // We use the same attributes as when setting, but set an empty value and expired date
    response.cookies.set(AUTH_COOKIE_NAME, '', {
        ...COOKIE_OPTIONS,
        expires: new Date(0),
    });

    return response;
});
