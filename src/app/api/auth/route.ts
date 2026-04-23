import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, 'api/auth');
    if (!allowed) {
        throw new TooManyRequestsError(undefined, undefined, retryAfterSeconds);
    }

    // TODO(issue-126): Implement session creation/refresh flow from docs/backend-session-csrf.md.
    // TODO(issue-126): For browser-originated auth mutations, issue CSRF token according to the doc strategy.
    // TODO: verify credentials (wallet signature / JWT), create signed cookie session (or chosen alternative), etc.

    return ok({ message: 'Authentication successful.' });
});
