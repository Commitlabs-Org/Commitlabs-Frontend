import { NextRequest, NextResponse } from 'next/server';
import { ok } from '@/lib/backend/apiResponse';
import { isFeatureEnabled } from '@/lib/backend/config';
import { InternalError, TooManyRequestsError } from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { logWarn } from '@/lib/backend/logger';
import { cache } from '@/lib/backend/cache/factory';
import { CacheKey, CacheTTL } from '@/lib/backend/cache/index';

/**
 * Cache-Control emitted on both hit and miss paths. `s-maxage` matches the
 * in-process `CacheTTL.MARKETPLACE_STATS` (30s) so shared caches do not
 * outlive the backing-store TTL, with `stale-while-revalidate` allowing a
 * graceful revalidation window for slightly stale aggregates.
 */
const STATS_CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=30';

/**
 * GET /api/marketplace/stats
 *
 * Returns aggregate statistics for the marketplace including active listings,
 * average yield, median price, and breakdown by commitment type.
 *
 * ## Caching Strategy and Failure Invariants
 *
 * Stats are cached for 30 seconds (`CacheTTL.MARKETPLACE_STATS`) and
 * invalidated whenever marketplace listings are created, cancelled, or sold so
 * aggregates remain accurate.
 *
 * The cache is **best-effort**: a read or write failure is treated as a miss
 * and the endpoint falls back to computing/serving fresh data rather than
 * failing an otherwise-successful aggregation. This endpoint must never return
 * a 5xx solely because the cache adapter is unavailable, and it must never
 * cache an invalid (non-object) result.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  if (!isFeatureEnabled('marketplace')) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Marketplace feature is disabled.',
          details: { feature: 'marketplace' },
        },
      },
      { status: 404 },
    );
  }

  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
  const isAllowed = await checkRateLimit(ip, 'api/marketplace/stats');

  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  // Attempt to retrieve from cache first. A cache read that throws (e.g. Redis
  // temporarily unreachable) is treated as a miss — serving freshly-computed
  // stats is strictly better than failing the request.
  const cacheKey = CacheKey.marketplaceStats();
  let cached;
  try {
    cached = await cache.get(cacheKey);
  } catch (err) {
    logWarn(req, '[api/marketplace/stats] cache read failed, falling back to fresh computation', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (cached && typeof cached === 'object') {
    const response = ok(cached);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('Cache-Control', STATS_CACHE_CONTROL);
    return response;
  }

  // Cache miss — fetch from service and cache result.
  const stats = await marketplaceService.getMarketplaceStats();

  // Adversarial guard: never cache or serve a malformed aggregate. A valid
  // empty result (all-zero counters) is still an object and is allowed — an
  // empty marketplace is a legitimate state, not a failure.
  if (!stats || typeof stats !== 'object') {
    throw new InternalError('Marketplace stats service returned an invalid aggregate.');
  }

  const response = ok(stats);

  // Cache write is best-effort: a backend cache outage must not turn a freshly
  // computed (valid) response into an error. If the write fails we still serve
  // the computed stats; the next request will simply re-compute them.
  try {
    await cache.set(cacheKey, stats, CacheTTL.MARKETPLACE_STATS);
  } catch (err) {
    logWarn(req, '[api/marketplace/stats] cache write failed, serving computed stats', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Add cache control headers for performance and scalability.
  // Stats are aggregated and suitable for caching to reduce server load.
  response.headers.set('X-Cache', 'MISS');
  response.headers.set('Cache-Control', STATS_CACHE_CONTROL);
  response.headers.set('Age', '0');

  return response;
});
