import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, fail, methodNotAllowed } from '@/lib/backend/apiResponse';
import { isFeatureEnabled } from '@/lib/backend/config';
import { TooManyRequestsError, UnauthorizedError, InternalError, ServiceUnavailableError } from '@/lib/backend/errors';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { verifySessionToken } from '@/lib/backend/auth';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { marketplaceService, getStatsGeneration } from '@/lib/backend/services/marketplace';
import { cache } from '@/lib/backend/cache/factory';
import {
  CacheKey,
  CacheTTL,
  envelopeFreshnessAgeSeconds,
  envelopeIsExpired,
  envelopeCanServeStale,
  isStatsEnvelope,
  type MarketplaceStatsEnvelope,
} from '@/lib/backend/cache/index';
import { generateETag, etagMatches } from '@/lib/backend/etag';

type MarketplaceStats = z.infer<typeof MarketplaceStatsSchema>;

const MarketplaceStatsSchema = z.object({
  activeListings: z.number().int().nonnegative(),
  averageYield: z.number().finite().nonnegative(),
  medianPrice: z.number().finite().nonnegative(),
  typeBreakdown: z.object({
    Safe: z.number().int().nonnegative(),
    Balanced: z.number().int().nonnegative(),
    Aggressive: z.number().int().nonnegative(),
  }),
});

/**
 * Validates an optional bearer token. If present, it must be a valid session
 * token. If absent, the request is treated as unauthenticated public access.
 *
 * This enforces the authorization boundary: any client claiming a wallet
 * identity must prove it, preventing tampered or replayed tokens from
 * bypassing downstream checks.
 */
function validateOptionalWalletAuth(req: NextRequest): void {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return;

  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authorization header must be in format: Bearer <token>');
  }

  const token = authHeader.slice(7);
  const session = verifySessionToken(token);

  if (!session.valid || !session.address) {
    throw new UnauthorizedError('Invalid or expired session token.');
  }
}

/**
 * Validates the numeric invariants of marketplace stats after aggregation.
 *
 * Rejects adversarial inputs such as NaN, Infinity, or negative values that
 * could corrupt downstream UI or analytics.
 */
function validateStatsData(data: unknown): MarketplaceStats {
  const parsed = MarketplaceStatsSchema.parse(data);

  const totalFromBreakdown =
    parsed.typeBreakdown.Safe + parsed.typeBreakdown.Balanced + parsed.typeBreakdown.Aggressive;

  if (totalFromBreakdown > parsed.activeListings) {
    throw new InternalError(
      'Marketplace stats invariant failed: type breakdown exceeds active listings.',
      {
        activeListings: parsed.activeListings,
        typeBreakdownTotal: totalFromBreakdown,
      },
    );
    response.headers.set('X-Stats-State', envelope.state);
    response.headers.set('X-Stats-Generation', String(envelope.generation));
    response.headers.set('X-Stats-LastValid-Generation', String(envelope.lastValidGeneration));
    response.headers.set('X-Stats-Age', String(meta.ageSeconds));

  return parsed;
}

export const GET = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
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

    try {
      validateOptionalWalletAuth(req);
    } catch (error) {
      throw error;
    }

    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
    const isAllowed = await checkRateLimit(ip, 'api/marketplace/stats');

    if (!isAllowed) {
      throw new TooManyRequestsError(
        'Rate limit exceeded for marketplace stats.',
        undefined,
        getRateLimitWindowSeconds('api/marketplace/stats'),
      );
    }

    const cacheKey = CacheKey.marketplaceStats();

    const cached = await cache.get<MarketplaceStats>(cacheKey);
    if (cached) {
      try {
        validateStatsData(cached);
        const response = ok(cached);
        response.headers.set('X-Cache', 'HIT');
        response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
        response.headers.set('X-Cache-Freshness', 'cached');
        return response;
      } catch {
        await cache.delete(cacheKey);
      }
    }

    let stats: unknown;
    try {
      stats = await marketplaceService.getMarketplaceStats();
    } catch (error) {
      throw new ServiceUnavailableError(
        'Failed to compute marketplace statistics.',
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }

    let validatedStats: MarketplaceStats;
    try {
      validatedStats = validateStatsData(stats);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return fail(
          'INTERNAL_ERROR',
          'Marketplace statistics returned malformed data.',
          { validationErrors: error.issues.map((e) => e.message) },
          500,
          correlationId,
        );
      }
      if (error instanceof InternalError) {
        return fail(error.code, error.message, error.details, error.statusCode, correlationId);
      }
      throw error;
    }

    await cache.set(cacheKey, validatedStats, CacheTTL.MARKETPLACE_STATS);

    const response = ok(validatedStats);
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    response.headers.set('X-Cache-Freshness', 'fresh');
    response.headers.set('X-Cache-TTL', String(CacheTTL.MARKETPLACE_STATS));

    return response;
  },
  { enableETag: true, cachePrivacy: 'public' },
);

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
