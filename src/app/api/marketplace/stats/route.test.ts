import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/backend/cache/factory', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    getMarketplaceStats: vi.fn().mockResolvedValue({
      activeListings: 5,
      avgYield: 12.5,
      medianPrice: 100,
      byType: { Safe: 3, Balanced: 1, Aggressive: 1 },
    }),
  },
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { cache } from '@/lib/backend/cache/factory';
import { marketplaceService } from '@/lib/backend/services/marketplace';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockCache = vi.mocked(cache);
const mockGetMarketplaceStats = vi.mocked(marketplaceService.getMarketplaceStats);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/marketplace/stats');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/marketplace/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockGetMarketplaceStats.mockResolvedValue({
      activeListings: 5,
      avgYield: 12.5,
      medianPrice: 100,
      byType: { Safe: 3, Balanced: 1, Aggressive: 1 },
    });
  });

  it('returns marketplace stats on success', async () => {
    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.activeListings).toBe(5);
  });

  it('serves from cache when available', async () => {
    mockCache.get.mockResolvedValue({ activeListings: 10, avgYield: 8 });

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.activeListings).toBe(10);
    expect(mockGetMarketplaceStats).not.toHaveBeenCalled();
    expect(res.headers.get('X-Cache')).toBe('HIT');
  });

  it('caches miss response', async () => {
    const req = makeRequest();
    await GET(req, { params: {} });

    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('marketplace:stats'),
      expect.any(Object),
      expect.any(Number),
    );
  });
});

// ─── Freshness & failure invariants (issue #1788) ───────────────────────────

const STATS_FIXTURE = {
  activeListings: 5,
  averageYield: 12.5,
  medianPrice: 100,
  typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
};

describe('GET /api/marketplace/stats — freshness and cache failure invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockGetMarketplaceStats.mockResolvedValue(STATS_FIXTURE);
  });

  it('emits a Cache-Control aligned with the 30s backing TTL', async () => {
    const res = await GET(makeRequest(), { params: {} }, 'corr');
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=30, stale-while-revalidate=30');
  });

  it('marks a cache hit with X-Cache: HIT and still emits cache headers', async () => {
    mockCache.get.mockResolvedValue({ activeListings: 10, averageYield: 8 });

    const res = await GET(makeRequest(), { params: {} }, 'corr');
    expect(res.headers.get('X-Cache')).toBe('HIT');
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=30, stale-while-revalidate=30');
    expect(mockGetMarketplaceStats).not.toHaveBeenCalled();
  });

  it('serves fresh stats (MISS) when the cache read throws, instead of failing', async () => {
    mockCache.get.mockRejectedValue(new Error('redis down'));

    const res = await GET(makeRequest(), { params: {} }, 'corr');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.activeListings).toBe(5);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(mockGetMarketplaceStats).toHaveBeenCalled();
  });

  it('serves computed stats when the cache write throws, instead of failing', async () => {
    mockCache.set.mockRejectedValue(new Error('redis down'));

    const res = await GET(makeRequest(), { params: {} }, 'corr');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.activeListings).toBe(5);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    // The write was attempted but its failure did not propagate to the caller.
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('treats a fully empty (zero) aggregate as a valid, cacheable state', async () => {
    mockGetMarketplaceStats.mockResolvedValue({
      activeListings: 0,
      averageYield: 0,
      medianPrice: 0,
      typeBreakdown: { Safe: 0, Balanced: 0, Aggressive: 0 },
    });

    const res = await GET(makeRequest(), { params: {} }, 'corr');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.activeListings).toBe(0);
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('returns 500 and does not cache when the service returns an invalid aggregate', async () => {
    mockGetMarketplaceStats.mockResolvedValue(null as never);

    const res = await GET(makeRequest(), { params: {} }, 'corr');

    expect(res.status).toBe(500);
    expect(mockCache.set).not.toHaveBeenCalled();
  });
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe('GET /api/marketplace/stats — rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('includes correlationId and timestamp in 429 body', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.error.correlationId).toBeDefined();
    expect(body.error.timestamp).toBeDefined();
    expect(typeof body.error.correlationId).toBe('string');
    expect(typeof body.error.timestamp).toBe('string');
  });

  it('sets x-correlation-id and x-request-id headers on 429', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
    const res = await GET(req, { params: {} });

    expect(res.headers.get('x-correlation-id')).toBeTruthy();
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns retryAfterSeconds in 429 body', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.error.retryAfterSeconds).toBe(60);
  });

  it('calls checkRateLimit with the correct routeId', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
    await GET(req, { params: {} });

    expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.any(String), 'api/marketplace/stats');
  });
});
