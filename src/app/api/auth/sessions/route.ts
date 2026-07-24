import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, fail } from '@/lib/backend/apiResponse';
import { AUTH_COOKIE_NAME, verifySessionToken, listOtherSessions } from '@/lib/backend/auth';

/**
 * GET /api/auth/sessions
 *
 * Returns the list of other active sessions for the authenticated user.
 * The current session is always marked with isCurrent: true.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
    const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME);
    const token = sessionCookie?.value;

    if (!token) {
        return fail('UNAUTHORIZED', 'Not authenticated', undefined, 401);
    }

    const verification = verifySessionToken(token);
    if (!verification.valid) {
        return fail('UNAUTHORIZED', verification.error ?? 'Invalid session', undefined, 401);
    }

    const otherSessions = listOtherSessions(token);

    const currentSession = {
        id: token,
        userAgent: req.headers.get('user-agent') ?? 'Unknown',
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'Unknown',
        createdAt: new Date().toISOString(),
        isCurrent: true,
    };

    const sessions = [
        currentSession,
        ...otherSessions.map((s) => ({
            id: s.id,
            userAgent: 'Unknown',
            ipAddress: 'Unknown',
            createdAt: s.createdAt,
            isCurrent: false,
        })),
    ];

    return ok({ sessions });
});
