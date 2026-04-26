import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, fail } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getUserNotifications } from '@/lib/backend/services/notifications';

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const ownerAddress = searchParams.get('ownerAddress');
  const page = Number(searchParams.get('page') ?? 1);
  const pageSize = Number(searchParams.get('pageSize') ?? 10);

  if (!ownerAddress) {
    return fail('BAD_REQUEST', 'Missing ownerAddress', undefined, 400);
  }

  if (page < 1 || pageSize < 1 || pageSize > 100) {
    return fail('BAD_REQUEST', 'Invalid pagination params', undefined, 400);
  }

  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

  const isAllowed = await checkRateLimit(ip, 'api/notifications');
  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const notifications = await getUserNotifications(ownerAddress);

  const start = (page - 1) * pageSize;
  const items = notifications.slice(start, start + pageSize);

  return ok({
    items,
    page,
    pageSize,
    total: notifications.length,
  });
});
