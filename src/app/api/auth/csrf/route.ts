import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { UnauthorizedError } from '@/lib/backend/errors';
import { getSessionRecord, readSessionIdFromRequest } from '@/lib/backend/session';

/**
 * Returns the current CSRF synchronizer token for the browser session.
 * Requires `cl_session` cookie (set after `/api/auth` or `/api/auth/verify`).
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const sessionId = readSessionIdFromRequest(req.cookies);
  if (!sessionId) {
    throw new UnauthorizedError('No active session.');
  }
  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new UnauthorizedError('Session is invalid or expired.');
  }
  return ok({ csrfToken: record.csrfToken });
});
