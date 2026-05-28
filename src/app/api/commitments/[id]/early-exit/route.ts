import { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { ConflictError, TooManyRequestsError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { logEarlyExit } from '@/lib/backend/logger';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { idempotencyService } from '@/lib/backend/idempotency';

const COMMITMENT_EARLY_EXIT_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_EARLY_EXIT_CORS_POLICY);

export const POST = withApiHandler(async (req: NextRequest, { params }, correlationId) => {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(ip, 'api/commitments/early-exit'))) {
    throw new TooManyRequestsError(
      'Too many requests. Please try again later.',
      undefined,
      getRateLimitWindowSeconds('api/commitments/early-exit'),
    );
  }

  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    const record = await idempotencyService.getRecord(idempotencyKey);
    if (record) {
      if (record.status === 'COMPLETED') {
        return ok(record.response, undefined, record.statusCode, correlationId);
      } else if (record.status === 'STARTED') {
        throw new ConflictError('A request with this Idempotency-Key is currently processing');
      }
    }
    await idempotencyService.start(idempotencyKey);
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    logEarlyExit({ ip, commitmentId: params.id, ...body });

    const responseData = {
      message: `Stub early-exit endpoint for commitment ${params.id}`,
      commitmentId: params.id,
    };

    if (idempotencyKey) {
      await idempotencyService.complete(idempotencyKey, responseData, 200);
    }

    return ok(responseData, undefined, 200, correlationId);
  } catch (error) {
    if (idempotencyKey) {
      await idempotencyService.fail(idempotencyKey);
    }
    throw error;
  }
}, { cors: COMMITMENT_EARLY_EXIT_CORS_POLICY });

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };