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
