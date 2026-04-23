import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError } from '@/lib/backend/errors';
import { generateNonce, storeNonce, generateChallengeMessage } from '@/lib/backend/auth';

const NonceRequestSchema = z.object({
    address: z.string().min(1, 'Address is required'),
});

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, 'api/auth/nonce');
    if (!allowed) {
        throw new TooManyRequestsError(undefined, undefined, retryAfterSeconds);
    }

    let body;
    try {
        body = await req.json();
    } catch {
        throw new ValidationError('Invalid JSON in request body');
    }

    const validation = NonceRequestSchema.safeParse(body);
    if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.errors);
    }

    const { address } = validation.data;

    const nonce = generateNonce();
    const nonceRecord = storeNonce(address, nonce);
    const challengeMessage = generateChallengeMessage(nonce);

    return ok({
        nonce,
        message: challengeMessage,
        expiresAt: nonceRecord.expiresAt.toISOString(),
    });
});
