import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/auth', () => ({
  verifySessionToken: vi.fn().mockReturnValue({ valid: false }),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getRateLimitWindowSeconds: vi.fn().mockReturnValue(60),
}));

vi.mock('@/lib/backend/config', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/backend/cache/factory', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  getStatsGeneration: vi.fn().mockResolvedValue(0),
  marketplaceService: {
    getMarketplaceStats: vi.fn().mockResolvedValue({
      activeListings: 5,
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    }),
  },
}));

import { GET } from './route';
import { verifySessionToken } from '@/lib/backend/auth';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { isFeatureEnabled } from '@/lib/backend/config';
import { cache } from '@/lib/backend/cache/factory';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { CacheKey } from '@/lib/backend/cache/index';

const mockVerifySessionToken = vi.mocked(verifySessionToken);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled);
const mockCache = vi.mocked(cache);
const mockGetMarketplaceStats = vi.mocked(marketplaceService.getMarketplaceStats);

const STATS_KEY = CacheKey.marketplaceStats();

function makeRequest(authHeader?: string, headers: Record<string, string> = {}): NextRequest {
  const mergedHeaders = new Headers();
  if (authHeader) {
    mergedHeaders.set('authorization', authHeader);
  }
  for (const [key, value] of Object.entries(headers)) {
    mergedHeaders.set(key, value);
  }
  return new NextRequest('http://localhost:3000/api/marketplace/stats', {
    headers: mergedHeaders,
  });
}

const VALID_STATS = {
  activeListings: 5,
  averageYield: 12.5,
  medianPrice: 100,
  typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
};

const getHandler = GET as (req: NextRequest, ctx: unknown) => Promise<Response>;

describe('GET /api/marketplace/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFeatureEnabled.mockReturnValue(true);
    mockCheckRateLimit.mockResolvedValue(true);
    mockVerifySessionToken.mockReturnValue({ valid: false });
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockCache.delete.mockResolvedValue(undefined);
    mockGetMarketplaceStats.mockResolvedValue({ ...VALID_STATS });
  });

  it('returns marketplace stats on success', async () => {
    const res = await getHandler(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.activeListings).toBe(5);
    expect(body.data.averageYield).toBe(12.5);
    expect(body.data.medianPrice).toBe(100);
    expect(body.data.typeBreakdown).toEqual({ Safe: 3, Balanced: 1, Aggressive: 1 });
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(res.headers.get('X-Cache-Freshness')).toBe('fresh');
    expect(res.headers.get('X-Cache-TTL')).toBe('30');
    expect(mockCache.set).toHaveBeenCalledWith(STATS_KEY, VALID_STATS, 30);
  });

  it('serves from cache when available', async () => {
    const cachedStats = {
      activeListings: 10,
      averageYield: 8,
      medianPrice: 200,
      typeBreakdown: { Safe: 6, Balanced: 2, Aggressive: 2 },
    };
    mockCache.get.mockResolvedValue(cachedStats);

    const res = await getHandler(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.activeListings).toBe(10);
    expect(mockGetMarketplaceStats).not.toHaveBeenCalled();
    expect(res.headers.get('X-Cache')).toBe('HIT');
    expect(res.headers.get('X-Cache-Freshness')).toBe('cached');
  });

  it('invalidates corrupt cache entries and refetches', async () => {
    mockCache.get.mockResolvedValueOnce({
      activeListings: -1,
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    });

    const res = await getHandler(makeRequest(), { params: {} });

    expect(mockCache.delete).toHaveBeenCalledWith(STATS_KEY);
    expect(mockGetMarketplaceStats).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
  });

  it('returns 500 when service returns malformed data', async () => {
    mockGetMarketplaceStats.mockResolvedValueOnce({
      activeListings: 'invalid',
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    } as never);

    const res = await getHandler(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toMatch(/malformed/i);
  });

  it('returns 500 when service returns negative values', async () => {
    mockGetMarketplaceStats.mockResolvedValueOnce({
      activeListings: -1,
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    } as never);

    const res = await getHandler(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 when typeBreakdown exceeds activeListings', async () => {
    mockGetMarketplaceStats.mockResolvedValueOnce({
      activeListings: 2,
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    } as never);

    const res = await getHandler(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toMatch(/invariant failed/i);
  });

  it('returns 503 when the service throws', async () => {
    mockGetMarketplaceStats.mockRejectedValueOnce(new Error('Chain unavailable'));

    const res = await getHandler(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns 404 NOT_FOUND when the marketplace feature is disabled', async () => {
    mockIsFeatureEnabled.mockImplementation((feature: string) => feature !== 'marketplace');

    const res = await getHandler(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockCache.set).not.toHaveBeenCalled();
  });

  it('emits an ETag and supports 304 Not Modified via If-None-Match', async () => {
    mockCache.get.mockResolvedValue(VALID_STATS);

    const first = await getHandler(makeRequest(), { params: {} });
    expect(first.status).toBe(200);
    const etag = first.headers.get('ETag');
    expect(etag).toBeTruthy();

    const second = await getHandler(makeRequest(undefined, { 'if-none-match': etag as string }), {
      params: {},
    });
    expect(second.status).toBe(304);
    expect(second.headers.get('ETag')).toBe(etag);
  });
});

describe('GET /api/marketplace/stats — rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFeatureEnabled.mockReturnValue(true);
    mockCheckRateLimit.mockResolvedValue(true);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockGetMarketplaceStats.mockResolvedValue({ ...VALID_STATS });
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const res = await getHandler(makeRequest(), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(body.error.retryAfterSeconds).toBe(60);
  });

  it('calls checkRateLimit with the marketplace stats route id', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    await getHandler(makeRequest(), { params: {} });

    expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.any(String), 'api/marketplace/stats');
  });
});

describe('GET /api/marketplace/stats — authorization boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFeatureEnabled.mockReturnValue(true);
    mockCheckRateLimit.mockResolvedValue(true);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockGetMarketplaceStats.mockResolvedValue({ ...VALID_STATS });
  });

  it('allows unauthenticated public access when no auth header is present', async () => {
    const res = await getHandler(makeRequest(), { params: {} });
    expect(res.status).toBe(200);
  });

  it('allows a request with a valid session token', async () => {
    mockVerifySessionToken.mockReturnValue({ valid: true, address: 'GADDRESS' });

    const res = await getHandler(makeRequest('Bearer session_validtoken_123'), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockVerifySessionToken).toHaveBeenCalledWith('session_validtoken_123');
    expect(body.data.activeListings).toBe(5);
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await getHandler(makeRequest('InvalidToken'), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid bearer token', async () => {
    mockVerifySessionToken.mockReturnValue({ valid: false });

    const res = await getHandler(makeRequest('Bearer invalid_token'), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});
