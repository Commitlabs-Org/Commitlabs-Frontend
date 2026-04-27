import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { verifySignatureWithNonce, createSessionToken } from '@/lib/backend/auth';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { TooManyRequestsError, ValidationError, UnauthorizedError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const VerifyRequestSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  signature: z.string().min(1, 'Signature is required'),
  message: z.string().min(1, 'Message is required'),
});

const AUTH_VERIFY_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(AUTH_VERIFY_CORS_POLICY);

export const POST = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  const ip = getClientIp(req);

  if (!(await checkRateLimit(ip, 'api/auth/verify'))) {
    throw new TooManyRequestsError('Rate limit exceeded. Please try again later.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError('Invalid JSON in request body');
  }

  const validation = VerifyRequestSchema.safeParse(body);
  if (!validation.success) {
    throw new ValidationError('Invalid request data', validation.error.issues);
  }

  const verificationResult = await verifySignatureWithNonce(validation.data);
  if (!verificationResult.valid) {
    throw new UnauthorizedError(verificationResult.error || 'Signature verification failed');
  }

  const sessionToken = createSessionToken(validation.data.address);

  return ok(
    {
      verified: true,
      address: verificationResult.address,
      message: 'Signature verified successfully',
      sessionToken,
    },
    undefined,
    200,
    correlationId,
  );
}, { cors: AUTH_VERIFY_CORS_POLICY });

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
