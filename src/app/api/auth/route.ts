import { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const AUTH_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(AUTH_CORS_POLICY);

export const POST = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  const ip = getClientIp(req);

  if (!(await checkRateLimit(ip, 'api/auth'))) {
    throw new TooManyRequestsError();
  }

  return ok({ message: 'Authentication successful.' }, undefined, 200, correlationId);
}, { cors: AUTH_CORS_POLICY });

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
