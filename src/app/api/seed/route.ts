import type { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { isSeedAllowed, seedMockData } from '@/lib/backend/seed';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const SEED_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(SEED_CORS_POLICY);

export const POST = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  if (!isSeedAllowed()) {
    return ok({ message: 'Not Found' }, 404, undefined, correlationId);
  }

  const secret = req.headers.get('x-seed-secret');
  const result = await seedMockData(secret);

  if (!result.seeded) {
    if (result.message === 'Invalid seed secret.') {
      return ok({ message: result.message }, 403, undefined, correlationId);
    }

    return ok({ message: result.message }, 500, undefined, correlationId);
  }

  return ok({ message: result.message }, 200, undefined, correlationId);
}, { cors: SEED_CORS_POLICY });

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
