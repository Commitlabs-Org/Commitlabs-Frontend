import { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { logInfo } from '@/lib/backend/logger';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { attachSecurityHeaders } from '@/utils/response';

const HEALTH_CORS_POLICY = {
  GET: { access: 'public' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(HEALTH_CORS_POLICY);

export const GET = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  logInfo(req, 'Healthcheck requested');

  const response = ok(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    },
    undefined,
    200,
    correlationId,
  );

  attachSecurityHeaders(response);
  return response;
}, { cors: HEALTH_CORS_POLICY });

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
