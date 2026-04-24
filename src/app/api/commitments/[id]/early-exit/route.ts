import { NextRequest } from 'next/server';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { logEarlyExit } from '@/lib/backend/logger';
import { TooManyRequestsError } from '@/lib/backend/errors';

export const POST = withApiHandler(async (req: NextRequest, context: { params: Record<string, string> }) => {
  assertMutationCsrf(req);

  const { id } = context.params;
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

  const isAllowed = await checkRateLimit(ip, 'api/commitments/early-exit');
  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  try {
    const body = await req.json();
    logEarlyExit({ ip, commitmentId: id, ...body });
  } catch {
    logEarlyExit({ ip, commitmentId: id, error: 'failed to parse request body' });
  }

  return ok({
    message: `Stub early-exit endpoint for commitment ${id}`,
    commitmentId: id,
  });
});
