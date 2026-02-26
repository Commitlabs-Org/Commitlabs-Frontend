import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { logInfo } from '@/lib/backend/logger';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  logInfo(req, 'Healthcheck requested');
  const response = NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  return attachSecurityHeaders(response);
}
export const GET = withApiHandler(async (req: NextRequest) => {
    logInfo(req, 'Health check requested');
    return ok({ status: 'healthy' });
});
