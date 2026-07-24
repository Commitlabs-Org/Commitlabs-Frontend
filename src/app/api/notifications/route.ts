import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, fail } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getUserNotifications } from '@/lib/backend/services/notifications';
import {
  jsonFilePreferencesStore,
  filterNotificationsByPreferences,
} from '@/lib/backend/preferences';

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

  // Respect the user's per-category opt-in preferences. Filtering happens
  // BEFORE pagination so `total` reflects what the user can actually see.
  // When no preferences are stored, safe opt-in defaults deliver everything.
  const prefs = await jsonFilePreferencesStore.get(ownerAddress);
  const visible = filterNotificationsByPreferences(notifications, prefs);

  const start = (page - 1) * pageSize;
  const items = visible.slice(start, start + pageSize);

  return ok({
    items,
    page,
    pageSize,
    total: visible.length,
  });
});