import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getMockData } from '@/lib/backend/mockDb';
import { logInfo } from '@/lib/backend/logger';

export const GET = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/commitments');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    const { commitments } = await getMockData();

    return ok({ commitments }, 200);
});
export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/commitments');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    logInfo(req, 'Creating commitment', { ip });

    // TODO(issue-126): Enforce validateSession(req) per docs/backend-session-csrf.md before mutating state.
    // TODO(issue-126): Enforce CSRF validation for browser cookie-auth requests (token + origin checks).
    // TODO: validate request body, interact with Soroban smart contract,
    //       store commitment record in database, mint NFT, etc.

    return ok({ message: 'Commitment created successfully.' }, 201);
});
