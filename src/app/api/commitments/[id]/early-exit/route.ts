import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { logEarlyExit } from '@/lib/backend/logger';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';

interface Params {
    params: { id: string };
}

export const POST = withApiHandler(async (req: NextRequest, { params }: Params) => {
    const { id } = params;

    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, 'api/commitments/early-exit');
    if (!allowed) {
        throw new TooManyRequestsError(undefined, undefined, retryAfterSeconds);
    }

    let body: Record<string, unknown> = {};
    try {
        body = await req.json();
    } catch {
        // non-fatal - log and continue
    }

    logEarlyExit({ ip, commitmentId: id, ...body });

    return ok({
        message: `Stub early-exit endpoint for commitment ${id}`,
        commitmentId: id,
    });
});
