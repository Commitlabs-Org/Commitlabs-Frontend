import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = getClientIp(req);

    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, 'api/auth');
    if (!allowed) {
        throw new TooManyRequestsError(undefined, undefined, retryAfterSeconds);
    }

    // TODO(issue-126): Implement session creation/refresh flow from docs/backend-session-csrf.md.
    // TODO(issue-126): For browser-originated auth mutations, issue CSRF token according to the doc strategy.
    // TODO: verify credentials (wallet signature / JWT), create signed cookie session (or chosen alternative), etc.

    return ok({ message: 'Authentication successful.' }, undefined, 200, correlationId);
});

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
