import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';

const { mockCache } = vi.hoisted(() => ({
  mockCache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    invalidate: vi.fn(),
  },
}));

vi.mock('@/lib/backend/cache/factory', () => ({
  cache: mockCache,
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    getMarketplaceStats: vi.fn(),
  },
}));

import { GET } from '@/app/api/marketplace/stats/route';
import { CacheTTL } from '@/lib/backend/cache/index';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { marketplaceService } from '@/lib/backend/services/marketplace';

const MARKETPLACE_STATS_KEY = 'commitlabs:marketplace:stats';

const marketplaceStats = {
  activeListings: 6,
  averageYield: 12.43,
  medianPrice: 130000,
  typeBreakdown: {
    Safe: 2,
    Balanced: 2,
    Aggressive: 2,
  },
};

function makeRequest(ip = '203.0.113.20') {
  return createMockRequest('http://localhost:3000/api/marketplace/stats', {
    headers: {
      'x-forwarded-for': ip,
    },
  });
}

describe('GET /api/marketplace/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    vi.mocked(marketplaceService.getMarketplaceStats).mockResolvedValue(
      marketplaceStats as any,
    );
  });

  it('returns cached stats and marks the response as a cache hit', async () => {
    mockCache.get.mockResolvedValue(marketplaceStats);

    const res = await GET(makeRequest(), { params: {} }, 'corr-stats-hit');
    const { status, data, headers } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(marketplaceStats);
    expect(headers.get('X-Cache')).toBe('HIT');
    expect(headers.get('Cache-Control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=30',
    );
    expect(mockCache.get).toHaveBeenCalledWith(MARKETPLACE_STATS_KEY);
    expect(marketplaceService.getMarketplaceStats).not.toHaveBeenCalled();
    expect(mockCache.set).not.toHaveBeenCalled();
  });

  it('fetches, caches, and returns stats on a cache miss', async () => {
    const res = await GET(makeRequest(), { params: {} }, 'corr-stats-miss');
    const { status, data, headers } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.data).toEqual(marketplaceStats);
    expect(headers.get('X-Cache')).toBe('MISS');
    expect(marketplaceService.getMarketplaceStats).toHaveBeenCalledTimes(1);
    expect(mockCache.set).toHaveBeenCalledWith(
      MARKETPLACE_STATS_KEY,
      marketplaceStats,
      CacheTTL.MARKETPLACE_STATS,
    );
  });

  it('returns zero-listing stats with the same response shape', async () => {
    const zeroStats = {
      activeListings: 0,
      averageYield: 0,
      medianPrice: 0,
      typeBreakdown: {
        Safe: 0,
        Balanced: 0,
        Aggressive: 0,
      },
    };
    vi.mocked(marketplaceService.getMarketplaceStats).mockResolvedValue(
      zeroStats as any,
    );

    const res = await GET(makeRequest(), { params: {} }, 'corr-stats-zero');
    const { status, data, headers } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.data).toEqual(zeroStats);
    expect(headers.get('X-Cache')).toBe('MISS');
    expect(mockCache.set).toHaveBeenCalledWith(
      MARKETPLACE_STATS_KEY,
      zeroStats,
      CacheTTL.MARKETPLACE_STATS,
    );
  });

  it('returns 429 without reading cache when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await GET(makeRequest(), { params: {} }, 'corr-stats-limit');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(mockCache.get).not.toHaveBeenCalled();
    expect(marketplaceService.getMarketplaceStats).not.toHaveBeenCalled();
  });
});
