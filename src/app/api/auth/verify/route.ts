import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError, UnauthorizedError } from '@/lib/backend/errors';
import { verifySignatureWithNonce, createSessionToken } from '@/lib/backend/auth';
import { createBrowserSession } from '@/lib/backend/session';
import { applySessionCookie } from '@/lib/backend/sessionCookies';

// Request validation schema
const VerifyRequestSchema = z.object({
    address: z.string().min(1, 'Address is required'),
    signature: z.string().min(1, 'Signature is required'),
    message: z.string().min(1, 'Message is required'),
});

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    // Rate limiting
    const isAllowed = await checkRateLimit(ip, 'api/auth/verify');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    // Parse and validate request body
    let body;
    try {
        body = await req.json();
    } catch {
        throw new ValidationError('Invalid JSON in request body');
    }

    const validation = VerifyRequestSchema.safeParse(body);
    if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.issues);
    }

    const { address, signature, message } = validation.data;

    // Verify the signature and nonce
    const verificationResult = verifySignatureWithNonce({
        address,
        signature,
        message,
    });

    if (!verificationResult.valid) {
        throw new UnauthorizedError(verificationResult.error || 'Signature verification failed');
    }

    const sessionToken = createSessionToken(address);
    const { sessionId, csrfToken } = createBrowserSession(verificationResult.address);

    const response = ok({
        verified: true,
        address: verificationResult.address,
        message: 'Signature verified successfully',
        sessionToken,
        sessionType: 'placeholder',
        csrfToken,
    });
    applySessionCookie(response, sessionId);
    return response;
});
