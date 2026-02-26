import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/response';
import { logInfo } from '@/lib/backend/logger';

export const GET = withApiHandler(async (req: NextRequest) => {
    logInfo(req, 'Health check requested');
    return ok({ status: 'healthy', timestamp: new Date().toISOString() });
});
