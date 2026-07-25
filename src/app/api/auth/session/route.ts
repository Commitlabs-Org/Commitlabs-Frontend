import { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/backend/auth';

/**
 * GET /api/auth/session
 *
 * Reports whether the caller holds a valid wallet-auth session, based solely
 * on the HttpOnly session cookie. Never echoes the session token back to the
 * client — only the address it belongs to.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return ok({ authenticated: false });
  }

  const verification = verifySessionToken(token);
  if (!verification.valid) {
    return ok({ authenticated: false });
  }

  return ok({ authenticated: true, address: verification.address });
});

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
