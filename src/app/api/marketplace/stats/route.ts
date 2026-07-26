import { NextRequest } from "next/server";
import { ok } from "@/lib/backend/apiResponse";
import { checkRateLimit } from "@/lib/backend/rateLimit";
import { withApiHandler } from "@/lib/backend/withApiHandler";
import { marketplaceService } from "@/lib/backend/services/marketplace";
import { cache } from "@/lib/backend/cache/factory";
import { CacheKey, CacheTTL } from "@/lib/backend/cache/index";

/**
 * GET /api/marketplace/stats
 *
 * Returns aggregate statistics for the marketplace including active listings,
 * average yield, median price, and breakdown by commitment type.
 *
 * ## Caching Strategy
 *
 * Stats are cached for 30 seconds (CacheTTL.MARKETPLACE_STATS). The cache is
 * invalidated whenever marketplace listings are created or cancelled to ensure
 * aggregates remain accurate.
 *
 * Cache-Control: public, s-maxage=60, stale-while-revalidate=30
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const ip = req.ip ?? req.headers.get("x-forwarded-for") ?? "anonymous";
  const isAllowed = await checkRateLimit(ip, "api/marketplace/stats");

  if (!isAllowed) {
    return Response.json(
      {
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests",
        },
      },
      { status: 429 },
    );
  }

  // Attempt to retrieve from cache first.
  const cacheKey = CacheKey.marketplaceStats();
  const cached = await cache.get(cacheKey);
  if (cached) {
    const response = ok(cached);
    response.headers.set("X-Cache", "HIT");
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=30",
    );
    return response;
  }

  // Cache miss — fetch from service and cache result.
  const stats = await marketplaceService.getMarketplaceStats();
  await cache.set(cacheKey, stats, CacheTTL.MARKETPLACE_STATS);

  const response = ok(stats);

  // Add cache control headers for performance and scalability.
  // Stats are aggregated and suitable for caching to reduce server load.
  response.headers.set("X-Cache", "MISS");
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=30",
  );

  return response;
});
