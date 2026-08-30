import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import {
  verifySignatureWithNonce,
  createSessionToken,
  AUTH_COOKIE_NAME,
  COOKIE_OPTIONS,
} from '@/lib/backend/auth';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { TooManyRequestsError, ValidationError, UnauthorizedError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { parseJsonWithLimit, JSON_BODY_LIMITS } from '@/lib/backend/jsonBodyLimit';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const VerifyRequestSchema = z.object({
  address: z.string().min(1, 'Address is required').max(128, 'Address is too long'),
  signature: z.string().min(1, 'Signature is required').max(1024, 'Signature is too long'),
  message: z.string().min(1, 'Message is required').max(2048, 'Message is too long'),
});

const AUTH_VERIFY_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(AUTH_VERIFY_CORS_POLICY);

export const POST = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
    const ip = getClientIp(req);

    if (!(await checkRateLimit(ip, 'api/auth/verify'))) {
      throw new TooManyRequestsError('Rate limit exceeded. Please try again later.');
    }

    const body = await parseJsonWithLimit(req, {
      limitBytes: JSON_BODY_LIMITS.authVerify,
    });

    const validation = VerifyRequestSchema.safeParse(body);
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues);
    }

    const verificationResult = await verifySignatureWithNonce(validation.data);
    if (!verificationResult.valid) {
      throw new UnauthorizedError(verificationResult.error || 'Signature verification failed');
    }

    const sessionToken = createSessionToken(validation.data.address);

    const response = ok(
      {
        verified: true,
        address: verificationResult.address,
        message: 'Signature verified successfully',
      },
      undefined,
      200,
      correlationId,
    );

    // Session lives exclusively in an HttpOnly cookie; the token itself is
    // never exposed to client-side JavaScript.
    response.cookies.set(AUTH_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);

    return response;
  },
  { cors: AUTH_VERIFY_CORS_POLICY },
);

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
