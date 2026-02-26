import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, fail } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError } from '@/lib/backend/errors';
import { generateNonce, storeNonce, generateChallengeMessage } from '@/lib/backend/auth';

// Request validation schema
const NonceRequestSchema = z.object({
    address: z.string().min(1, 'Address is required'),
});

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    // Rate limiting
    const isAllowed = await checkRateLimit(ip, 'api/auth/nonce');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    // Parse and validate request body
    let body;
    try {
        body = await req.json();
    } catch (error) {
        throw new ValidationError('Invalid JSON in request body');
    }

    const validation = NonceRequestSchema.safeParse(body);
    if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.errors);
    }

    const { address } = validation.data;

    // TODO: Add additional validation for Stellar address format
    // For now, we'll accept any string but could add Stellar address validation

    // Generate and store nonce
    const nonce = generateNonce();
    const nonceRecord = storeNonce(address, nonce);
    const challengeMessage = generateChallengeMessage(nonce);

    // Return the nonce and challenge message
    return ok({
        nonce,
        message: challengeMessage,
        expiresAt: nonceRecord.expiresAt.toISOString(),
    });
});
