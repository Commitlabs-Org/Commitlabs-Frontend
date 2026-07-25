import type { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { ForbiddenError, InternalError, NotFoundError } from '@/lib/backend/errors';
import { isSeedAllowed, seedMockData } from '@/lib/backend/seed';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const SEED_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(SEED_CORS_POLICY);

export const POST = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  if (!isSeedAllowed()) {
    // Issue #1372: throw so withApiHandler builds a `success: false`
    // envelope via fail(), instead of ok()'s `success: true` for a 404.
    throw new NotFoundError('Route');
  }

  const secret = req.headers.get('x-seed-secret');
  const result = await seedMockData(secret);

  if (!result.seeded) {
    if (result.message === 'Invalid seed secret.') {
      throw new ForbiddenError(result.message);
    }

    throw new InternalError(result.message);
  }

  return ok({ message: result.message }, 200, undefined, correlationId);
}, { cors: SEED_CORS_POLICY });

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
