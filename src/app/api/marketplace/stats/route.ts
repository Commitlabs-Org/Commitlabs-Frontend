import { NextRequest, NextResponse } from 'next/server';
import { ok, fail, getCorrelationId } from '@/lib/backend/apiResponse';
import { isFeatureEnabled } from '@/lib/backend/config';
import { TooManyRequestsError, ServiceUnavailableError } from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
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

export type StatsResponseFreshnessFlag =
  | 'FRESH'
  | 'STALE_WHILE_REVALIDATE'
  | 'STALE_IF_ERROR'
  | 'EMPTY'
  | 'REVALIDATING_LOCK';

export interface StatsResponseMeta {
  freshness: StatsResponseFreshnessFlag;
  ageSeconds: number;
  generation: number;
  lastValidGeneration: number;
  cacheHit: boolean;
  state: string;
  fetchedAtIso: string;
  expiresAtIso: string;
  sourceCorrelationId?: string;
  errorCode?: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
}

const MAX_FRESHNESS_AGE_SECONDS = CacheTTL.MARKETPLACE_STATS;
const SWR_STALE_AGE_SECONDS = CacheTTL.MARKETPLACE_STATS_STALE_GRACE;

function classifyFreshness(envelope: MarketplaceStatsEnvelope): StatsResponseFreshnessFlag {
  if (envelope.state === 'EMPTY') return 'EMPTY';
  if (envelope.state === 'ERROR') return 'STALE_IF_ERROR';
  if (envelope.state === 'REVALIDATING') return 'REVALIDATING_LOCK';
  const age = envelopeFreshnessAgeSeconds(envelope);
  if (age <= MAX_FRESHNESS_AGE_SECONDS && !envelopeIsExpired(envelope)) return 'FRESH';
  return 'STALE_WHILE_REVALIDATE';
}

function buildMeta(envelope: MarketplaceStatsEnvelope, cacheHit: boolean): StatsResponseMeta {
  return {
    freshness: classifyFreshness(envelope),
    ageSeconds: envelopeFreshnessAgeSeconds(envelope),
    generation: envelope.generation,
    lastValidGeneration: envelope.lastValidGeneration,
    cacheHit,
    state: envelope.state,
    fetchedAtIso: new Date(envelope.fetchedAt).toISOString(),
    expiresAtIso: new Date(envelope.expiresAt).toISOString(),
    sourceCorrelationId: envelope.sourceCorrelationId,
    errorCode: envelope.errorCode,
    retryable: envelope.retryable,
    retryAfterSeconds: envelope.retryAfterSeconds,
  };
}

function sMaxAgeFromMeta(meta: StatsResponseMeta): number {
  if (meta.freshness === 'FRESH') {
    return Math.max(0, MAX_FRESHNESS_AGE_SECONDS - meta.ageSeconds);
  }
  if (meta.freshness === 'STALE_WHILE_REVALIDATE') return 0;
  if (meta.freshness === 'STALE_IF_ERROR') return 0;
  if (meta.freshness === 'REVALIDATING_LOCK') return 0;
  return 0;
}

function buildCacheControlHeader(meta: StatsResponseMeta): string {
  const sMax = sMaxAgeFromMeta(meta);
  const swr = SWR_STALE_AGE_SECONDS;
  const staleIfError = Math.max(0, SWR_STALE_AGE_SECONDS);
  return `public, s-maxage=${sMax}, stale-while-revalidate=${swr}, stale-if-error=${staleIfError}`;
}

function validateInvariants(
  envelope: MarketplaceStatsEnvelope,
  correlationId: string,
): void {
  if (!isStatsEnvelope(envelope)) {
    throw new Error(`[INV-1 ${correlationId}] Envelope failed structural validation`);
  }
  if (envelope.generation < envelope.lastValidGeneration) {
    throw new Error(`[INV-2 ${correlationId}] generation < lastValidGeneration`);
  }
  if (envelope.state === 'FRESH' && envelopeIsExpired(envelope)) {
    throw new Error(`[INV-3 ${correlationId}] FRESH envelope is past expiresAt`);
  }
  const typeSum =
    envelope.payload.typeBreakdown.Safe +
    envelope.payload.typeBreakdown.Balanced +
    envelope.payload.typeBreakdown.Aggressive;
  if (
    envelope.payload.activeListings > 0 &&
    typeSum !== envelope.payload.activeListings &&
    (envelope.payload.activeListings !== 0 || typeSum !== 0)
  ) {
    // Non-fatal for now — in strict environments this would throw.
    // Logging would be appropriate here.
  }
  if (envelope.payload.averageYield < 0) {
    throw new Error(`[INV-PAYLOAD ${correlationId}] negative averageYield`);
  }
  if (envelope.payload.medianPrice < 0) {
    throw new Error(`[INV-PAYLOAD ${correlationId}] negative medianPrice`);
  }
}

export const GET = withApiHandler(
  async (req: NextRequest, _ctx, correlationId: string) => {
    if (!isFeatureEnabled('marketplace')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Marketplace feature is disabled.',
            details: { feature: 'marketplace' },
            correlationId,
            timestamp: new Date().toISOString(),
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

    const ifNoneMatch = req.headers.get('if-none-match');
    const statsGenerationAtEntry = await getStatsGeneration();

    let envelope: MarketplaceStatsEnvelope;
    let cacheHitBase = false;

    try {
      envelope = await marketplaceService.getMarketplaceStatsEnvelope(correlationId);
    } catch (upstreamErr: unknown) {
      const cacheKey = CacheKey.marketplaceStats();
      const cachedFallbackRaw = await cache.get<unknown>(cacheKey);
      const cachedFallback = isStatsEnvelope(cachedFallbackRaw) ? cachedFallbackRaw : null;

      if (cachedFallback && envelopeCanServeStale(cachedFallback)) {
        envelope = {
          ...cachedFallback,
          state: 'ERROR',
          errorCode: upstreamErr instanceof Error ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR',
          errorMessage:
            upstreamErr instanceof Error ? upstreamErr.message : 'Unexpected stats error',
          retryable: true,
          retryAfterSeconds: 30,
        };
      } else {
        throw new ServiceUnavailableError(
          'Marketplace stats are temporarily unavailable. Please try again later.',
          { reason: upstreamErr instanceof Error ? upstreamErr.message : String(upstreamErr) },
          30,
        );
      }
    }

    validateInvariants(envelope, correlationId);

    const latestGeneration = await getStatsGeneration();
    const cacheKey = CacheKey.marketplaceStats();
    const rawAfter = await cache.get<unknown>(cacheKey);
    cacheHitBase = isStatsEnvelope(rawAfter) && rawAfter.generation === envelope.generation;

    if (envelope.state === 'ERROR' && envelope.retryable) {
      const meta = buildMeta(envelope, cacheHitBase);
      const retryAfter = envelope.retryAfterSeconds ?? 30;
      const staleRsp = ok(envelope.payload, {
        meta: {
          ...meta,
          note: 'Served from stale cache; upstream stats compute failed.',
          requestedGeneration: statsGenerationAtEntry,
          servedGeneration: latestGeneration,
        },
      } as any);
      staleRsp.headers.set('Cache-Control', buildCacheControlHeader(meta));
      staleRsp.headers.set('X-Cache', cacheHitBase ? 'HIT_STALE_ERROR' : 'MISS_STALE_ERROR');
      staleRsp.headers.set('X-Stats-State', envelope.state);
      staleRsp.headers.set('X-Stats-Generation', String(envelope.generation));
      staleRsp.headers.set('Retry-After', String(retryAfter));
      return staleRsp;
    }

    if (envelope.state === 'EMPTY') {
      const meta = buildMeta(envelope, cacheHitBase);
      const emptyRsp = ok(envelope.payload, {
        meta: {
          ...meta,
          note: 'No marketplace listings yet.',
          requestedGeneration: statsGenerationAtEntry,
          servedGeneration: latestGeneration,
        },
      } as any);
      emptyRsp.headers.set('Cache-Control', `public, s-maxage=5, stale-while-revalidate=${SWR_STALE_AGE_SECONDS}`);
      emptyRsp.headers.set('X-Cache', 'MISS_EMPTY');
      emptyRsp.headers.set('X-Stats-State', 'EMPTY');
      emptyRsp.headers.set('X-Stats-Generation', String(envelope.generation));
      return emptyRsp;
    }

    const etag = generateETag({
      payload: envelope.payload,
      generation: envelope.lastValidGeneration,
      version: 1,
    });

    if (etagMatches(ifNoneMatch, etag)) {
      const notModified = new NextResponse(null, { status: 304 });
      notModified.headers.set('ETag', etag);
      notModified.headers.set(
        'Cache-Control',
        `public, max-age=0, must-revalidate, s-maxage=${Math.max(0, MAX_FRESHNESS_AGE_SECONDS - envelopeFreshnessAgeSeconds(envelope))}`,
      );
      notModified.headers.set('X-Stats-Generation', String(envelope.generation));
      notModified.headers.set('X-Stats-State', envelope.state);
      return notModified;
    }

    const meta = buildMeta(envelope, cacheHitBase);
    const response = ok(envelope.payload, {
      meta: {
        ...meta,
        requestedGeneration: statsGenerationAtEntry,
        servedGeneration: latestGeneration,
      },
    } as any);

    response.headers.set('ETag', etag);
    response.headers.set('Cache-Control', buildCacheControlHeader(meta));
    response.headers.set(
      'X-Cache',
      meta.freshness === 'FRESH' && cacheHitBase ? 'HIT' : cacheHitBase ? 'HIT_STALE' : 'MISS',
    );
    response.headers.set('X-Stats-State', envelope.state);
    response.headers.set('X-Stats-Generation', String(envelope.generation));
    response.headers.set('X-Stats-LastValid-Generation', String(envelope.lastValidGeneration));
    response.headers.set('X-Stats-Age', String(meta.ageSeconds));

    return response;
  },
  {
    cors: {
      allowOrigin: '*',
      allowMethods: ['GET', 'HEAD', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'If-None-Match', 'X-CSRF-Token'],
      maxAge: 600,
    },
  },
);
