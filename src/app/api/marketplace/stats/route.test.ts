import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { verifySessionToken } from '@/lib/backend/auth';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/auth', () => ({
  verifySessionToken: vi.fn().mockReturnValue({ valid: false, address: undefined }),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getRateLimitWindowSeconds: vi.fn().mockReturnValue(60),
}));

vi.mock('@/lib/backend/cache/factory', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    getMarketplaceStats: vi.fn().mockResolvedValue({
      activeListings: 5,
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    }),
  },
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { cache } from '@/lib/backend/cache/factory';
import { marketplaceService } from '@/lib/backend/services/marketplace';

const mockVerifySessionToken = vi.mocked(verifySessionToken);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockCache = vi.mocked(cache);
const mockGetMarketplaceStats = vi.mocked(marketplaceService.getMarketplaceStats);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) {
    headers.set('authorization', authHeader);
  }
  return new NextRequest('http://localhost:3000/api/marketplace/stats', { headers });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/marketplace/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockCache.delete.mockResolvedValue(undefined);
    mockGetMarketplaceStats.mockResolvedValue({
      activeListings: 5,
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    });
    mockVerifySessionToken.mockReturnValue({ valid: false });
  });

  it('returns marketplace stats on success', async () => {
    const req = makeRequest();
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.activeListings).toBe(5);
    expect(body.data.averageYield).toBe(12.5);
    expect(body.data.medianPrice).toBe(100);
    expect(body.data.typeBreakdown).toEqual({ Safe: 3, Balanced: 1, Aggressive: 1 });
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(res.headers.get('X-Cache-Freshness')).toBe('fresh');
    expect(res.headers.get('X-Cache-TTL')).toBe(String(30));
  });

  it('serves from cache when available', async () => {
    mockCache.get.mockResolvedValue({
      activeListings: 10,
      averageYield: 8,
      medianPrice: 200,
      typeBreakdown: { Safe: 6, Balanced: 2, Aggressive: 2 },
    });

    const req = makeRequest();
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.activeListings).toBe(10);
    expect(mockGetMarketplaceStats).not.toHaveBeenCalled();
    expect(res.headers.get('X-Cache')).toBe('HIT');
    expect(res.headers.get('X-Cache-Freshness')).toBe('cached');
  });

  it('caches miss response', async () => {
    const req = makeRequest();
    await (GET as any)(req, { params: {} } as any);

    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('marketplace:stats'),
      expect.objectContaining({
        activeListings: 5,
        averageYield: 12.5,
        medianPrice: 100,
        typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
      }),
      30,
    );
  });

  it('invalidates corrupt cache and refetches', async () => {
    mockCache.get.mockResolvedValueOnce({
      activeListings: -1,
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    });

    const req = makeRequest();
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);

    expect(mockCache.delete).toHaveBeenCalledWith('commitlabs:marketplace:stats');
    expect(res.status).toBe(200);
    expect(mockGetMarketplaceStats).toHaveBeenCalled();
  });

  it('returns 500 when service returns malformed data', async () => {
    mockGetMarketplaceStats.mockResolvedValueOnce({
      activeListings: 'invalid',
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    } as any);

    const req = makeRequest();
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toContain('malformed');
  });

  it('returns 500 when service returns negative values', async () => {
    mockGetMarketplaceStats.mockResolvedValueOnce({
      activeListings: -1,
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    });

    const req = makeRequest();
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);
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
    });

    const req = makeRequest();
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toContain('invariant failed');
  });

  it('returns 503 when service throws', async () => {
    mockGetMarketplaceStats.mockRejectedValueOnce(new Error('Chain unavailable'));

    const req = makeRequest();
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe('GET /api/marketplace/stats — rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockGetMarketplaceStats.mockResolvedValue({
      activeListings: 5,
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    });
    mockVerifySessionToken.mockReturnValue({ valid: false });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('returns retryAfterSeconds in 429 body', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);
    const body = await res.json();

    expect(body.error.retryAfterSeconds).toBe(60);
  });

  it('calls checkRateLimit with the correct routeId', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
    await (GET as any)(req, { params: {} } as any);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.any(String), 'api/marketplace/stats');
  });
});

// ─── Authorization boundary ───────────────────────────────────────────────────

describe('GET /api/marketplace/stats — auth boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockGetMarketplaceStats.mockResolvedValue({
      activeListings: 5,
      averageYield: 12.5,
      medianPrice: 100,
      typeBreakdown: { Safe: 3, Balanced: 1, Aggressive: 1 },
    });
  });

  it('allows unauthenticated public access when no auth header is present', async () => {
    mockVerifySessionToken.mockReturnValue({ valid: false });

    const req = makeRequest();
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);

    expect(res.status).toBe(200);
  });

  it('allows request with valid session token', async () => {
    mockVerifySessionToken.mockReturnValue({ valid: true, address: 'GADDRESS' });

    const req = makeRequest('Bearer session_validtoken_123');
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);

    expect(res.status).toBe(200);
    expect(mockVerifySessionToken).toHaveBeenCalledWith('session_validtoken_123');
  });

  it('rejects malformed Authorization header', async () => {
    const req = makeRequest('InvalidToken');
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid bearer token', async () => {
    mockVerifySessionToken.mockReturnValue({ valid: false });

    const req = makeRequest('Bearer invalid_token');
const getHandler = GET as any;
    const res = await getHandler(req, { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});
