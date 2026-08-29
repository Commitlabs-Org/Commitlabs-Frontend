/*
 * Cache adapter module for Commitlabs backend.
 *
 * Two adapters ship with this module:
 *   - MemoryAdapter  default for NODE_ENV=test|development. Zero dependencies,
 *                    TTL enforced on read, safe to use across test runs.
 *   - RedisAdapter   used when NODE_ENV=production and REDIS_URL is set (or when
 *                    CACHE_ADAPTER=redis is explicitly set). Requires ioredis:
 *                    `npm install ioredis`
 *
 * The active adapter is selected in factory.ts at module load time. To override
 * the default selection set CACHE_ADAPTER=redis|memory in your environment.
 *
 * All keys are namespaced under "commitlabs:" to avoid collisions with other
 * tenants sharing the same Redis instance.
 */

import type {
  MarketplaceCommitmentType,
  MarketplaceStats,
} from '@/lib/backend/services/marketplace';

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Remove every key whose name starts with `prefix`. */
  invalidate(prefix: string): Promise<void>;
}

export type StatsFreshnessState = 'FRESH' | 'STALE' | 'REVALIDATING' | 'ERROR' | 'EMPTY';

export interface MarketplaceStatsEnvelope {
  version: 1;
  payload: MarketplaceStats;
  fetchedAt: number;
  expiresAt: number;
  state: StatsFreshnessState;
  generation: number;
  lastValidGeneration: number;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
  sourceCorrelationId?: string;
}

export interface MarketplaceStatsPayloadShape {
  activeListings: number;
  averageYield: number;
  medianPrice: number;
  typeBreakdown: Record<MarketplaceCommitmentType, number>;
}

export const STATS_EMPTY_PAYLOAD: MarketplaceStatsPayloadShape = Object.freeze({
  activeListings: 0,
  averageYield: 0,
  medianPrice: 0,
  typeBreakdown: { Safe: 0, Balanced: 0, Aggressive: 0 },
});

export function isMarketplaceStatsPayload(value: unknown): value is MarketplaceStatsPayloadShape {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.activeListings === 'number' &&
    Number.isFinite(v.activeListings) &&
    v.activeListings >= 0 &&
    typeof v.averageYield === 'number' &&
    Number.isFinite(v.averageYield) &&
    v.averageYield >= 0 &&
    typeof v.medianPrice === 'number' &&
    Number.isFinite(v.medianPrice) &&
    v.medianPrice >= 0 &&
    typeof v.typeBreakdown === 'object' &&
    v.typeBreakdown !== null &&
    ['Safe', 'Balanced', 'Aggressive'].every(
      (k) =>
        typeof (v.typeBreakdown as Record<string, unknown>)[k] === 'number' &&
        Number.isFinite((v.typeBreakdown as Record<string, number>)[k]) &&
        (v.typeBreakdown as Record<string, number>)[k] >= 0,
    )
  );
}

export function isStatsEnvelope(value: unknown): value is MarketplaceStatsEnvelope {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.fetchedAt === 'number' &&
    typeof v.expiresAt === 'number' &&
    typeof v.generation === 'number' &&
    typeof v.lastValidGeneration === 'number' &&
    typeof v.state === 'string' &&
    ['FRESH', 'STALE', 'REVALIDATING', 'ERROR', 'EMPTY'].includes(v.state as string) &&
    isMarketplaceStatsPayload(v.payload)
  );
}

export function makeStatsEnvelope(
  payload: MarketplaceStats,
  generation: number,
  state: StatsFreshnessState,
  ttlSeconds: number,
  correlationId?: string,
): MarketplaceStatsEnvelope {
  const now = Date.now();
  return {
    version: 1,
    payload,
    fetchedAt: now,
    expiresAt: now + ttlSeconds * 1000,
    state,
    generation,
    lastValidGeneration: state === 'FRESH' ? generation : generation - 1,
    sourceCorrelationId: correlationId,
  };
}

export function envelopeFreshnessAgeSeconds(envelope: MarketplaceStatsEnvelope): number {
  return Math.max(0, Math.floor((Date.now() - envelope.fetchedAt) / 1000));
}

export function envelopeIsExpired(envelope: MarketplaceStatsEnvelope): boolean {
  return Date.now() > envelope.expiresAt;
}

export function envelopeCanServeStale(
  envelope: MarketplaceStatsEnvelope,
  graceMs = 60_000,
): boolean {
  return (
    envelope.state === 'FRESH' ||
    envelope.state === 'STALE' ||
    (envelope.state === 'ERROR' && Date.now() - envelope.fetchedAt < graceMs)
  );
}

export const CacheKey = {
  commitment: (id: string) => `commitlabs:commitment:${id}`,
  userCommitments: (ownerAddress: string) => `commitlabs:user-commitments:${ownerAddress}`,
  marketplaceListings: (queryHash: string) => `commitlabs:marketplace:listings:${queryHash}`,
  commitmentSearch: (queryHash: string) => `commitlabs:commitment-search:${queryHash}`,
} as const;

/** TTL in seconds — keep short so stale chain data doesn't linger. */
export const CacheTTL = {
  COMMITMENT_DETAIL: 30,
  USER_COMMITMENTS: 20,
  MARKETPLACE_LISTINGS: 15,
  MARKETPLACE_STATS: 30,
  MARKETPLACE_STATS_STALE_GRACE: 120,
  MARKETPLACE_STATS_LOCK_TTL: 10,
  MARKETPLACE_STATS_GENERATION_TTL: 86_400,
  COMMITMENT_SEARCH: 15,
} as const;
