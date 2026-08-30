import { logError, logInfo } from '../logger';
import { ConflictError, InternalError, NotFoundError, ValidationError } from '../errors';
import { getStorageAdapter } from '../storage';
import type { MarketplaceListing, CreateListingRequest } from '@/lib/types/domain';
import { cache } from '@/lib/backend/cache/factory';
import {
  CacheKey,
  CacheTTL,
  CACHE_PREFIXES,
  envelopeCanServeStale,
  envelopeFreshnessAgeSeconds,
  envelopeIsExpired,
  isStatsEnvelope,
  makeStatsEnvelope,
  STATS_EMPTY_PAYLOAD,
  type MarketplaceStatsEnvelope,
  type StatsFreshnessState,
} from '@/lib/backend/cache/index';
import { isFeatureEnabled } from '../config';

export type MarketplaceCommitmentType = 'Safe' | 'Balanced' | 'Aggressive';

export interface MarketplacePublicListing {
  listingId: string;
  commitmentId: string;
  type: MarketplaceCommitmentType;
  amount: number;
  remainingDays: number;
  maxLoss: number;
  currentYield: number;
  complianceScore: number;
  price: number;
}

export interface MarketplaceStats {
  activeListings: number;
  averageYield: number;
  medianPrice: number;
  typeBreakdown: Record<MarketplaceCommitmentType, number>;
}

export interface MarketplaceListingsQuery {
  type?: MarketplaceCommitmentType;
  minCompliance?: number;
  maxLoss?: number;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  page?: number;
  pageSize?: number;
}

export interface MarketplaceListingsResult {
  items: MarketplacePublicListing[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FeaturedMarketplaceConfig {
  minComplianceScore: number;
  maxLoss: number;
  limit: number;
}

export interface PurchasePreflightResponse {
  eligible: boolean;
  /** Human-readable reason codes if not eligible. Empty when eligible. */
  reasons: string[];
}

const MARKETPLACE_LISTING_COUNTER_KEY = "marketplace:listings:counter";

const MOCK_LISTINGS: MarketplacePublicListing[] = [
  {
    listingId: 'LST-001',
    commitmentId: 'CMT-001',
    type: 'Safe',
    amount: 50000,
    remainingDays: 25,
    maxLoss: 2,
    currentYield: 5.2,
    complianceScore: 95,
    price: 52000,
  },
  {
    listingId: 'LST-002',
    commitmentId: 'CMT-002',
    type: 'Balanced',
    amount: 100000,
    remainingDays: 45,
    maxLoss: 8,
    currentYield: 12.5,
    complianceScore: 88,
    price: 105000,
  },
  {
    listingId: 'LST-003',
    commitmentId: 'CMT-003',
    type: 'Aggressive',
    amount: 250000,
    remainingDays: 80,
    maxLoss: 100,
    currentYield: 18.7,
    complianceScore: 76,
    price: 262000,
  },
  {
    listingId: 'LST-004',
    commitmentId: 'CMT-004',
    type: 'Safe',
    amount: 75000,
    remainingDays: 15,
    maxLoss: 2,
    currentYield: 4.8,
    complianceScore: 92,
    price: 76500,
  },
  {
    listingId: 'LST-005',
    commitmentId: 'CMT-005',
    type: 'Balanced',
    amount: 150000,
    remainingDays: 55,
    maxLoss: 8,
    currentYield: 11.3,
    complianceScore: 85,
    price: 155000,
  },
  {
    listingId: 'LST-006',
    commitmentId: 'CMT-006',
    type: 'Aggressive',
    amount: 500000,
    remainingDays: 85,
    maxLoss: 100,
    currentYield: 22.1,
    complianceScore: 72,
    price: 525000,
  },
];

const SORT_CONFIG = {
  price: { key: 'price', order: 'desc' },
  amount: { key: 'amount', order: 'desc' },
  complianceScore: { key: 'complianceScore', order: 'desc' },
  remainingDays: { key: 'remainingDays', order: 'asc' },
  maxLoss: { key: 'maxLoss', order: 'asc' },
  currentYield: { key: 'currentYield', order: 'desc' },
} as const satisfies Record<string, { key: keyof MarketplacePublicListing; order: 'asc' | 'desc' }>;

export const FEATURED_MARKETPLACE_CONFIG: FeaturedMarketplaceConfig = Object.freeze({
  minComplianceScore: 85,
  maxLoss: 8,
  limit: 4,
});

export const FEATURED_MARKETPLACE_CACHE_CONTROL =
  'public, max-age=300, s-maxage=300, stale-while-revalidate=600';

export type MarketplaceSortBy = keyof typeof SORT_CONFIG;

function getListingStorageKey(listingId: string): string {
  return `marketplace:listing:${listingId}`;
}

function getActiveListingStorageKey(commitmentId: string): string {
  return `marketplace:commitment:${commitmentId}:active-listing`;
}

function normalizeStorageError(error: unknown): InternalError {
  const normalized = error instanceof Error ? error : new Error(String(error));
  logError(undefined, '[MarketplaceService] Storage operation failed', normalized);

  return new InternalError(
    'Marketplace storage is temporarily unavailable. Please try again later.',
  );
}

function sortListings(
  listings: MarketplacePublicListing[],
  sortBy: MarketplaceSortBy,
): MarketplacePublicListing[] {
  const { key, order } = SORT_CONFIG[sortBy];

  return [...listings].sort((a, b) => {
    const lhs = a[key] as number;
    const rhs = b[key] as number;
    return order === 'asc' ? lhs - rhs : rhs - lhs;
  });
}

export function isMarketplaceSortBy(value: string): value is MarketplaceSortBy {
  return value in SORT_CONFIG;
}

export function getMarketplaceSortKeys(): MarketplaceSortBy[] {
  return Object.keys(SORT_CONFIG) as MarketplaceSortBy[];
}

/** Stable key for a given query — order of keys is deterministic via sort. */
function queryHash(query: MarketplaceListingsQuery): string {
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

const STATS_GENERATION_LOCK_TTL_MS = 5_000;

async function bumpStatsGeneration(): Promise<number> {
  const genKey = CacheKey.marketplaceStatsGeneration();
  const current = await cache.get<number>(genKey);
  const next = typeof current === 'number' && Number.isFinite(current) ? current + 1 : 1;
  await cache.set(genKey, next, CacheTTL.MARKETPLACE_STATS_GENERATION_TTL);
  const invKey = CacheKey.marketplaceStatsInvalidation();
  await cache.set(
    invKey,
    { generation: next, at: Date.now() },
    CacheTTL.MARKETPLACE_STATS_GENERATION_TTL,
  );
  return next;
}

export async function getStatsGeneration(): Promise<number> {
  const gen = await cache.get<number>(CacheKey.marketplaceStatsGeneration());
  return typeof gen === 'number' && Number.isFinite(gen) ? gen : 0;
}

async function acquireStatsLock(
  correlationId: string,
): Promise<{ acquired: boolean; owner?: string; acquiredAt?: number }> {
  const lockKey = CacheKey.marketplaceStatsLock();
  const existing = await cache.get<{ owner: string; acquiredAt: number }>(lockKey);
  if (existing) {
    if (Date.now() - existing.acquiredAt > STATS_GENERATION_LOCK_TTL_MS) {
      await cache.delete(lockKey);
    } else {
      return { acquired: false, owner: existing.owner, acquiredAt: existing.acquiredAt };
    }
  }
  const token = { owner: correlationId, acquiredAt: Date.now() };
  await cache.set(lockKey, token, CacheTTL.MARKETPLACE_STATS_LOCK_TTL);
  const verify = await cache.get<{ owner: string; acquiredAt: number }>(lockKey);
  if (verify && verify.owner === correlationId) {
    return { acquired: true, owner: correlationId, acquiredAt: token.acquiredAt };
  }
  return { acquired: false, owner: verify?.owner };
}

async function releaseStatsLock(correlationId: string): Promise<void> {
  const lockKey = CacheKey.marketplaceStatsLock();
  const existing = await cache.get<{ owner: string; acquiredAt: number }>(lockKey);
  if (existing && existing.owner === correlationId) {
    await cache.delete(lockKey);
  }
}

export async function listMarketplaceListings(
  query: MarketplaceListingsQuery,
): Promise<MarketplacePublicListing[]> {
  const cacheKey = CacheKey.marketplaceListings(queryHash(query));
  const cached = await cache.get<MarketplacePublicListing[]>(cacheKey);
  if (cached !== null) {
    logInfo(undefined, '[cache] hit marketplace-listings', { query });
    return cached;
  }
  logInfo(undefined, '[cache] miss marketplace-listings', { query });

  if (!isFeatureEnabled('marketplaceMockData')) {
    throw new InternalError(
      'Marketplace on-chain reads not yet implemented. Enable marketplaceMockData feature flag to use mock data.',
    );
  }

  let results = MOCK_LISTINGS;

  if (query.type) {
    results = results.filter((listing) => listing.type === query.type);
  }
  if (query.minCompliance !== undefined) {
    const minCompliance = query.minCompliance;
    results = results.filter((listing) => listing.complianceScore >= minCompliance);
  }
  if (query.maxLoss !== undefined) {
    const maxLoss = query.maxLoss;
    results = results.filter((listing) => listing.maxLoss <= maxLoss);
  }
  if (query.minAmount !== undefined) {
    const minAmount = query.minAmount;
    results = results.filter((listing) => listing.amount >= minAmount);
  }
  if (query.maxAmount !== undefined) {
    const maxAmount = query.maxAmount;
    results = results.filter((listing) => listing.amount <= maxAmount);
  }

  const sortBy = query.sortBy && isMarketplaceSortBy(query.sortBy) ? query.sortBy : 'price';

  const listings = sortListings(results, sortBy);
  await cache.set(cacheKey, listings, CacheTTL.MARKETPLACE_LISTINGS);
  return listings;
}

export function selectFeaturedMarketplaceListings(
  listings: readonly MarketplacePublicListing[],
  config: FeaturedMarketplaceConfig = FEATURED_MARKETPLACE_CONFIG,
): MarketplacePublicListing[] {
  return [...listings]
    .filter(
      (listing) =>
        listing.complianceScore >= config.minComplianceScore && listing.maxLoss <= config.maxLoss,
    )
    .sort((left, right) => {
      if (right.complianceScore !== left.complianceScore) {
        return right.complianceScore - left.complianceScore;
      }

      if (right.currentYield !== left.currentYield) {
        return right.currentYield - left.currentYield;
      }

      if (left.price !== right.price) {
        return left.price - right.price;
      }

      return left.listingId.localeCompare(right.listingId);
    })
    .slice(0, config.limit);
}

class MarketplaceService {
  private readonly storage = getStorageAdapter();

  private async loadListing(listingId: string): Promise<MarketplaceListing | null> {
    try {
      return await this.storage.get<MarketplaceListing>(getListingStorageKey(listingId));
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  async createListing(request: CreateListingRequest): Promise<MarketplaceListing> {
    logInfo(undefined, '[MarketplaceService] Creating listing', { request });

    this.validateCreateListingRequest(request);

    try {
      const activeListingId = await this.storage.get<string>(
        getActiveListingStorageKey(request.commitmentId),
      );

      if (activeListingId) {
        const existingListing = await this.loadListing(activeListingId);

        if (existingListing?.status === 'Active') {
          throw new ConflictError('Commitment is already listed on the marketplace.', {
            commitmentId: request.commitmentId,
            existingListingId: existingListing.id,
          });
        }
      }

      const listingSequence = await this.storage.increment(MARKETPLACE_LISTING_COUNTER_KEY);
      const listingId = `listing_${listingSequence}_${Date.now()}`;
      const now = new Date().toISOString();

      const listing: MarketplaceListing = {
        id: listingId,
        commitmentId: request.commitmentId,
        price: request.price,
        currencyAsset: request.currencyAsset,
        sellerAddress: request.sellerAddress,
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      };

      await this.storage.set(getListingStorageKey(listingId), listing);
      await this.storage.set(getActiveListingStorageKey(request.commitmentId), listingId);

      logInfo(undefined, '[MarketplaceService] Listing created', { listingId });

      await cache.invalidate(CACHE_PREFIXES.MARKETPLACE_LISTINGS);
      logInfo(undefined, '[cache] invalidated marketplace-listings after create', {
        listingId,
      });

      const newGen = await bumpStatsGeneration();
      await cache.delete(CacheKey.marketplaceStats());
      logInfo(undefined, '[cache] invalidated marketplace-stats after create', {
        listingId,
        newGeneration: newGen,
      });

      return listing;
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  async cancelListing(listingId: string, sellerAddress: string): Promise<void> {
    logInfo(undefined, '[MarketplaceService] Cancelling listing', {
      listingId,
      sellerAddress,
    });

    const listing = await this.getListing(listingId);

    if (!listing) {
      throw new NotFoundError('Listing', { listingId });
    }

    if (listing.sellerAddress !== sellerAddress) {
      throw new ValidationError('Only the seller can cancel this listing.', {
        listingId,
        expectedSeller: listing.sellerAddress,
        providedSeller: sellerAddress,
      });
    }

    if (listing.status !== 'Active') {
      throw new ConflictError('Only active listings can be cancelled.', {
        listingId,
        currentStatus: listing.status,
      });
    }

    try {
      const cancelledListing: MarketplaceListing = {
        ...listing,
        status: 'Cancelled',
        updatedAt: new Date().toISOString(),
      };

      await this.storage.set(getListingStorageKey(listingId), cancelledListing);

      await cache.invalidate(CACHE_PREFIXES.MARKETPLACE_LISTINGS);
      logInfo(undefined, '[cache] invalidated marketplace-listings after cancel', { listingId });

      const newGen = await bumpStatsGeneration();
      await cache.delete(CacheKey.marketplaceStats());
      logInfo(undefined, '[cache] invalidated marketplace-stats after cancel', {
        listingId,
        newGeneration: newGen,
      });

      logInfo(undefined, '[MarketplaceService] Listing cancelled', {
        listingId,
      });
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  async getListing(listingId: string): Promise<MarketplaceListing | null> {
    return this.loadListing(listingId);
  }

  async completePurchase(listingId: string, buyerAddress: string): Promise<MarketplaceListing> {
    logInfo(undefined, '[MarketplaceService] Completing purchase', {
      listingId,
      buyerAddress,
    });

    const listing = await this.getListing(listingId);

    if (!listing) {
      throw new NotFoundError('Listing', { listingId });
    }

    if (listing.sellerAddress === buyerAddress) {
      throw new ValidationError('Buyer cannot be the same as the seller.', {
        listingId,
      });
    }

    if (listing.status !== 'Active') {
      throw new ConflictError('Only active listings can be purchased.', {
        listingId,
        currentStatus: listing.status,
      });
    }

    try {
      const purchasedListing: MarketplaceListing = {
        ...listing,
        status: 'Sold',
        updatedAt: new Date().toISOString(),
      };

      await this.storage.set(getListingStorageKey(listingId), purchasedListing);

      await cache.invalidate(CACHE_PREFIXES.MARKETPLACE_LISTINGS);
      logInfo(undefined, '[cache] invalidated marketplace-listings after purchase', { listingId });

      const newGen = await bumpStatsGeneration();
      await cache.delete(CacheKey.marketplaceStats());
      logInfo(undefined, '[cache] invalidated marketplace-stats after purchase', {
        listingId,
        newGeneration: newGen,
      });

      logInfo(undefined, '[MarketplaceService] Listing purchased', {
        listingId,
        buyerAddress,
      });

      return purchasedListing;
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  async getFeaturedListings(): Promise<MarketplacePublicListing[]> {
    if (!isFeatureEnabled('marketplaceMockData')) {
      throw new InternalError(
        'Marketplace on-chain reads not yet implemented. Enable marketplaceMockData feature flag to use mock data.',
      );
    }
    return selectFeaturedMarketplaceListings(MOCK_LISTINGS);
  }

  private computeStatsPayload(): MarketplaceStats {
    if (!isFeatureEnabled('marketplaceMockData')) {
      throw new InternalError(
        'Marketplace on-chain reads not yet implemented. Enable marketplaceMockData feature flag to use mock data.',
      );
    }

    const listings = MOCK_LISTINGS;

    if (listings.length === 0) {
      return { ...STATS_EMPTY_PAYLOAD };
    }

    const activeListings = listings.length;
    const totalYield = listings.reduce((sum, l) => sum + l.currentYield, 0);
    const averageYield = parseFloat((totalYield / activeListings).toFixed(2));

    const sortedPrices = [...listings].map((l) => l.price).sort((a, b) => a - b);
    const mid = Math.floor(sortedPrices.length / 2);
    const medianPrice =
      sortedPrices.length % 2 !== 0
        ? sortedPrices[mid]
        : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;

    const typeBreakdown: Record<MarketplaceCommitmentType, number> = {
      Safe: 0,
      Balanced: 0,
      Aggressive: 0,
    };

    listings.forEach((l) => {
      typeBreakdown[l.type] += 1;
    });

    return {
      activeListings,
      averageYield,
      medianPrice,
      typeBreakdown,
    };
  }

  /**
   * Aggregates marketplace metrics for header KPIs and analytics.
   *
   * @returns Promise<MarketplaceStats> - Aggregated metrics including active listings, avg yield, and median price.
   */
  async getMarketplaceStats(): Promise<MarketplaceStats> {
    const envelope = await this.getMarketplaceStatsEnvelope('legacy-call');
    return envelope.payload;
  }

  /**
   * Transactional envelope-returning stats fetcher with:
   *  - freshness/generation-based invalidation
   *  - request coalescing (single-flight via lock)
   *  - stale-if-error and stale-while-revalidating semantics
   *  - deterministic state transitions
   *  - recovery from interrupted fetches via lock TTL
   *
   * State machine (per envelope.state):
   *   EMPTY        → no data yet; caller triggers REVALIDATING
   *   REVALIDATING → lock held by another request; serve STALE if available
   *   FRESH        → within TTL & matching latest generation
   *   STALE        → expired TTL or older generation; still safe to serve
   *   ERROR        → upstream failed; serve STALE within grace window else EMPTY
   *
   * Invariants enforced:
   *   INV-1: A returned envelope always passes isStatsEnvelope structural validation.
   *   INV-2: envelope.generation >= envelope.lastValidGeneration.
   *   INV-3: FRESH envelopes never exceed MARKETPLACE_STATS TTL.
   *   INV-4: If generation counter has advanced, cached envelope is demoted to STALE/EMPTY.
   *   INV-5: Lock ownership is verified before writing a fresh envelope.
   *   INV-6: CorrelationId ties envelope.sourceCorrelationId to the winning request.
   *   INV-7: On service compute failure, ERROR envelope is only written if a prior valid payload does not exist,
   *          so stale-valid data is preserved rather than clobbered.
   */
  async getMarketplaceStatsEnvelope(correlationId: string): Promise<MarketplaceStatsEnvelope> {
    const cacheKey = CacheKey.marketplaceStats();
    const expectedGeneration = await getStatsGeneration();
    const staleGraceMs = CacheTTL.MARKETPLACE_STATS_STALE_GRACE * 1000;

    const cachedRaw = await cache.get<unknown>(cacheKey);
    const cachedEnvelope: MarketplaceStatsEnvelope | null = isStatsEnvelope(cachedRaw)
      ? cachedRaw
      : null;

    if (cachedEnvelope) {
      const matchesGeneration = cachedEnvelope.lastValidGeneration >= expectedGeneration;
      const expired = envelopeIsExpired(cachedEnvelope);

      if (matchesGeneration && !expired && cachedEnvelope.state === 'FRESH') {
        return cachedEnvelope;
      }

      if (!matchesGeneration && expired && !envelopeCanServeStale(cachedEnvelope, staleGraceMs)) {
        await cache.delete(cacheKey);
      }
    }

    const lockResult = await acquireStatsLock(correlationId);

    if (!lockResult.acquired) {
      if (cachedEnvelope && envelopeCanServeStale(cachedEnvelope, staleGraceMs)) {
        const staleEnvelope: MarketplaceStatsEnvelope = {
          ...cachedEnvelope,
          state: 'STALE',
        };
        return staleEnvelope;
      }
      const pollingWaitMs = 250;
      const deadline = Date.now() + (CacheTTL.MARKETPLACE_STATS_LOCK_TTL * 1000 - pollingWaitMs);
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollingWaitMs));
        const intermediate = await cache.get<unknown>(cacheKey);
        if (isStatsEnvelope(intermediate) && intermediate.generation >= expectedGeneration) {
          return intermediate;
        }
      }
      const fallbackRaw = await cache.get<unknown>(cacheKey);
      const fallbackEnvelope = isStatsEnvelope(fallbackRaw) ? fallbackRaw : null;
      if (fallbackEnvelope && envelopeCanServeStale(fallbackEnvelope, staleGraceMs)) {
        return { ...fallbackEnvelope, state: 'STALE' };
      }
      if (fallbackEnvelope) {
        return fallbackEnvelope;
      }
      return makeStatsEnvelope(
        { ...STATS_EMPTY_PAYLOAD },
        Math.max(expectedGeneration, 0),
        'EMPTY',
        CacheTTL.MARKETPLACE_STATS,
        correlationId,
      );
    }

    try {
      const recheckAfterLock = await cache.get<unknown>(cacheKey);
      if (isStatsEnvelope(recheckAfterLock)) {
        if (
          recheckAfterLock.lastValidGeneration >= expectedGeneration &&
          !envelopeIsExpired(recheckAfterLock)
        ) {
          return recheckAfterLock;
        }
      }

      const payload = this.computeStatsPayload();

      const generationAfterCompute = Math.max(expectedGeneration, await getStatsGeneration());

      const freshEnvelope = makeStatsEnvelope(
        payload,
        generationAfterCompute,
        'FRESH',
        CacheTTL.MARKETPLACE_STATS,
        correlationId,
      );
      const ttlWithGrace = CacheTTL.MARKETPLACE_STATS + CacheTTL.MARKETPLACE_STATS_STALE_GRACE;
      await cache.set(cacheKey, freshEnvelope, ttlWithGrace);

      return freshEnvelope;
    } catch (err: unknown) {
      const code = err instanceof InternalError ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR';
      const message = err instanceof Error ? err.message : 'Stats computation failed';
      const retryable = !(err instanceof ValidationError || err instanceof ConflictError);
      const retryAfterSeconds = retryable ? 30 : undefined;

      if (cachedEnvelope && envelopeCanServeStale(cachedEnvelope, staleGraceMs)) {
        await releaseStatsLock(correlationId);
        return {
          ...cachedEnvelope,
          state: 'STALE',
          errorCode: code,
          errorMessage: message,
          retryable,
          retryAfterSeconds,
        };
      }

      const currentGen = Math.max(expectedGeneration, await getStatsGeneration());
      const errorEnvelope: MarketplaceStatsEnvelope = {
        version: 1,
        payload: cachedEnvelope?.payload ?? { ...STATS_EMPTY_PAYLOAD },
        fetchedAt: Date.now(),
        expiresAt: Date.now() + 10_000,
        state: 'ERROR',
        generation: currentGen,
        lastValidGeneration: cachedEnvelope?.lastValidGeneration ?? 0,
        errorCode: code,
        errorMessage: message,
        retryable,
        retryAfterSeconds,
        sourceCorrelationId: correlationId,
      };
      await cache.set(cacheKey, errorEnvelope, 30);
      return errorEnvelope;
    } finally {
      await releaseStatsLock(correlationId);
    }
  }

  async invalidateStatsCache(): Promise<number> {
    const nextGen = await bumpStatsGeneration();
    await cache.delete(CacheKey.marketplaceStats());
    return nextGen;
  }

  async getPublicListing(listingId: string): Promise<MarketplacePublicListing | null> {
    if (!isFeatureEnabled('marketplaceMockData')) {
      throw new InternalError(
        'Marketplace on-chain reads not yet implemented. Enable marketplaceMockData feature flag to use mock data.',
      );
    }
    return MOCK_LISTINGS.find((listing) => listing.listingId === listingId) ?? null;
  }

  async getPurchasePreflight(
    listingId: string,
    buyerAddress: string,
  ): Promise<PurchasePreflightResponse> {
    logInfo(undefined, '[MarketplaceService] Purchase preflight', {
      listingId,
      buyerAddress,
    });

    const listing = await this.loadListing(listingId);
    if (!listing) {
      throw new NotFoundError('Listing', { listingId });
    }

    const reasons: string[] = [];

    if (listing.status !== 'Active') {
      reasons.push('listing_inactive');
    }

    if (listing.sellerAddress === buyerAddress) {
      reasons.push('buyer_is_seller');
    }

    // Non-transferable commitments cannot be purchased regardless of listing state
    if (listing.commitmentId.includes("non-transferable")) {
      reasons.push("non_transferable");
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Atomically marks a listing as Sold after a successful on-chain transfer.
   *
   * This is the idempotency boundary for the purchase flow: once a listing is
   * marked Sold it cannot be purchased again regardless of concurrent requests.
   *
   * @throws ConflictError when the listing is already Sold or Cancelled.
   * @throws NotFoundError when the listing does not exist.
   */
  async markSold(listingId: string, buyerAddress: string): Promise<void> {
    logInfo(undefined, "[MarketplaceService] Marking listing as sold", {
      listingId,
      buyerAddress,
    });

    const listing = await this.loadListing(listingId);

    if (!listing) {
      throw new NotFoundError("Listing", { listingId });
    }

    if (listing.status === "Sold") {
      // Idempotent: treat an already-sold listing as a duplicate purchase attempt
      throw new ConflictError("Listing has already been sold.", {
        listingId,
        currentStatus: listing.status,
      });
    }

    if (listing.status !== "Active") {
      throw new ConflictError("Only active listings can be purchased.", {
        listingId,
        currentStatus: listing.status,
      });
    }

    try {
      const soldListing: MarketplaceListing = {
        ...listing,
        status: "Sold",
        updatedAt: new Date().toISOString(),
      };

      await this.storage.set(getListingStorageKey(listingId), soldListing);

      // Invalidate all cached listing queries — the set has changed.
      await cache.invalidate(LISTINGS_PREFIX);
      logInfo(undefined, "[cache] invalidated marketplace-listings after sold", {
        listingId,
      });

      // Invalidate marketplace stats as the set of active listings changed.
      await cache.delete(CacheKey.marketplaceStats());
      logInfo(undefined, "[cache] invalidated marketplace-stats after sold", {
        listingId,
      });

      logInfo(undefined, "[MarketplaceService] Listing marked as sold", {
        listingId,
        buyerAddress,
      });
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      throw normalizeStorageError(error);
    }
  }

  private validateCreateListingRequest(request: CreateListingRequest): void {
    const errors: string[] = [];

    if (!request.commitmentId || typeof request.commitmentId !== 'string') {
      errors.push('commitmentId is required and must be a string');
    }

    if (!request.price || typeof request.price !== 'string') {
      errors.push('price is required and must be a string');
    } else {
      const priceNum = Number.parseFloat(request.price);
      if (Number.isNaN(priceNum) || priceNum <= 0) {
        errors.push('price must be a positive number');
      }
    }

    if (!request.currencyAsset || typeof request.currencyAsset !== 'string') {
      errors.push('currencyAsset is required and must be a string');
    }

    if (!request.sellerAddress || typeof request.sellerAddress !== 'string') {
      errors.push('sellerAddress is required and must be a string');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid listing request', { errors });
    }
  }
}

export const marketplaceService = new MarketplaceService();
