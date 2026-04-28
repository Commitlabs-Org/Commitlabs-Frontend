import { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { logEarlyExit } from '@/lib/backend/logger';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const COMMITMENT_EARLY_EXIT_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_EARLY_EXIT_CORS_POLICY);

export const POST = withApiHandler(async (req: NextRequest, { params }, correlationId) => {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(ip, 'api/commitments/early-exit'))) {
    throw new TooManyRequestsError();
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  logEarlyExit({ ip, commitmentId: params.id, ...body });

  return ok(
    {
      message: `Stub early-exit endpoint for commitment ${params.id}`,
      commitmentId: params.id,
    },
    undefined,
    200,
    correlationId,
  );
}, { cors: COMMITMENT_EARLY_EXIT_CORS_POLICY });

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
