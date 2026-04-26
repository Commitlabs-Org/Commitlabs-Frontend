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

    // Rate limiting by IP
    const isIpAllowed = await checkRateLimit(ip, 'api/auth/nonce');
    if (!isIpAllowed) {
        throw new TooManyRequestsError('Rate limit exceeded for your IP. Please try again later.');
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

    // Rate limiting by Stellar Address
    const isAddressAllowed = await checkRateLimit(address, 'auth:nonce:address');
    if (!isAddressAllowed) {
        throw new TooManyRequestsError('Too many nonce requests for this address. Please try again later.');
    }

    // Generate and store nonce (async)
    const nonce = generateNonce();
    const nonceRecord = await storeNonce(address, nonce);
    const challengeMessage = generateChallengeMessage(nonce);

    return ok({
        nonce,
        message: challengeMessage,
        expiresAt: nonceRecord.expiresAt.toISOString(),
    });
});

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
