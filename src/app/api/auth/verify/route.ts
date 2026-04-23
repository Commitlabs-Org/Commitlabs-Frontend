import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError, UnauthorizedError } from '@/lib/backend/errors';
import { verifySignatureWithNonce, createSessionToken } from '@/lib/backend/auth';

const VerifyRequestSchema = z.object({
    address: z.string().min(1, 'Address is required'),
    signature: z.string().min(1, 'Signature is required'),
    message: z.string().min(1, 'Message is required'),
});

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, 'api/auth/verify');
    if (!allowed) {
        throw new TooManyRequestsError(undefined, undefined, retryAfterSeconds);
    }

    let body;
    try {
        body = await req.json();
    } catch {
        throw new ValidationError('Invalid JSON in request body');
    }

    const validation = VerifyRequestSchema.safeParse(body);
    if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.errors);
    }

    const { address, signature, message } = validation.data;

    const verificationResult = verifySignatureWithNonce({
        address,
        signature,
        message,
    });

    if (!verificationResult.valid) {
        throw new UnauthorizedError(verificationResult.error || 'Signature verification failed');
    }

    const sessionToken = createSessionToken(address);

    return ok({
        verified: true,
        address: verificationResult.address,
        message: 'Signature verified successfully',
        sessionToken,
        sessionType: 'placeholder',
    });
});
