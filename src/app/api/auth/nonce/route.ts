import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { generateChallengeMessage, generateNonce, storeNonce } from '@/lib/backend/auth';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { TooManyRequestsError, ValidationError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const NonceRequestSchema = z.object({
  address: z.string().min(1, 'Address is required'),
});

const AUTH_NONCE_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(AUTH_NONCE_CORS_POLICY);

export const POST = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  const ip = getClientIp(req);

  if (!(await checkRateLimit(ip, 'api/auth/nonce'))) {
    throw new TooManyRequestsError('Rate limit exceeded for your IP. Please try again later.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError('Invalid JSON in request body');
  }

  const validation = NonceRequestSchema.safeParse(body);
  if (!validation.success) {
    throw new ValidationError('Invalid request data', validation.error.issues);
  }

  const { address } = validation.data;

  if (!(await checkRateLimit(address, 'auth:nonce:address'))) {
    throw new TooManyRequestsError('Too many nonce requests for this address. Please try again later.');
  }

  const nonce = generateNonce();
  const nonceRecord = await storeNonce(address, nonce);
  const challengeMessage = generateChallengeMessage(nonce);

  return ok(
    {
      nonce,
      message: challengeMessage,
      expiresAt: nonceRecord.expiresAt.toISOString(),
    },
    undefined,
    200,
    correlationId,
  );
}, { cors: AUTH_NONCE_CORS_POLICY });

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
