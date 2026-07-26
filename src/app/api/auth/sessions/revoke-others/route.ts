import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, fail } from '@/lib/backend/apiResponse';
import { AUTH_COOKIE_NAME, verifySessionToken, revokeOtherSessions } from '@/lib/backend/auth';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { checkRateLimit } from '@/lib/backend/rateLimit';

/**
 * POST /api/auth/sessions/revoke-others
 *
 * Revokes all other active sessions belonging to the authenticated user,
 * preserving only the current session.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = getClientIp(req);

    if (!(await checkRateLimit(ip, 'api/auth/sessions/revoke-others'))) {
        throw new TooManyRequestsError('Rate limit exceeded. Please try again later.');
    }

    const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME);
    const token = sessionCookie?.value;

    if (!token) {
        return fail('UNAUTHORIZED', 'Not authenticated', undefined, 401);
    }

    const verification = verifySessionToken(token);
    if (!verification.valid) {
        return fail('UNAUTHORIZED', verification.error ?? 'Invalid session', undefined, 401);
    }

    const revokedCount = revokeOtherSessions(token);

    return ok({
        message: `Revoked ${revokedCount} other session${revokedCount !== 1 ? 's' : ''}.`,
        revokedCount,
    });
});
