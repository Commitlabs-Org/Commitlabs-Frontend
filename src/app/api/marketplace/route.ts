import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getMockData } from '@/lib/backend/mockDb';

export const GET = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/marketplace');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    const { listings } = await getMockData();

    return ok({ listings }, 200);
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { logInfo } from '@/lib/backend/logger';

export const GET = withApiHandler(async (req: NextRequest) => {
    logInfo(req, 'Marketplace items requested');
    // TODO: Fetch marketplace items from database or smart contract
    return ok({ items: [] }, 200);
});
