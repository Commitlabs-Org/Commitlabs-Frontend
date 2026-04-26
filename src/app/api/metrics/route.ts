import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import type { HealthMetrics } from '@/lib/types/domain';

export const GET = withApiHandler(async (req: NextRequest, context: { params: Record<string, string> }, correlationId: string) => {
  const metrics: HealthMetrics = {
    status: 'up',
    uptime: process.uptime(),
    mock_requests_total: Math.floor(Math.random() * 1000),
    mock_errors_total: Math.floor(Math.random() * 10),
    timestamp: new Date().toISOString(),
  };

  return ok(metrics);
});

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
