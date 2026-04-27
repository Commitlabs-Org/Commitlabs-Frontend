import { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { getCountersAdapter } from '@/lib/backend/counters/provider';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import type { HealthMetrics } from '@/lib/types/domain';

const METRICS_CORS_POLICY = {
  GET: { access: 'public' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(METRICS_CORS_POLICY);

export const GET = withApiHandler(async (_req: NextRequest, _context, correlationId) => {
  const countersAdapter = getCountersAdapter();
  const metrics: HealthMetrics = {
    status: 'up',
    uptime: process.uptime(),
    ...(await countersAdapter.getMetrics()),
  };

  return ok(metrics, undefined, 200, correlationId);
}, { cors: METRICS_CORS_POLICY });

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
