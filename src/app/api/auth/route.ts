import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { createBrowserSession } from '@/lib/backend/session';
import { applySessionCookie } from '@/lib/backend/sessionCookies';

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/auth');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    const { sessionId, csrfToken } = createBrowserSession();
    const response = ok({
        message: 'Authentication successful.',
        csrfToken,
    });
    applySessionCookie(response, sessionId);
    return response;
});
