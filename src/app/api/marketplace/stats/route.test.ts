import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { verifySessionToken } from '@/lib/backend/auth';

const memoryStore = new Map<string, { value: unknown; expiresAt: number }>();

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

vi.mock('@/lib/backend/services/marketplace', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    getStatsGeneration: vi.fn(async () => {
      const entry = memoryStore.get('commitlabs:marketplace:stats:generation') as
        | { value: number; expiresAt: number }
        | undefined;
      return entry?.value ?? 0;
    }),
    marketplaceService: {
      ...(original.marketplaceService as object),
      getMarketplaceStatsEnvelope: vi.fn(),
      getMarketplaceStats: vi.fn().mockResolvedValue({
        activeListings: 6,
        averageYield: 12.43,
        medianPrice: 130000,
        typeBreakdown: { Safe: 2, Balanced: 2, Aggressive: 2 },
      }),
    },
  };
});

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { cache } from '@/lib/backend/cache/factory';
import { isFeatureEnabled } from '@/lib/backend/config';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { makeStatsEnvelope, type MarketplaceStatsEnvelope } from '@/lib/backend/cache/index';

const mockVerifySessionToken = vi.mocked(verifySessionToken);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockCache = vi.mocked(cache);
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled);
const mockGetMarketplaceStatsEnvelope = vi.mocked(marketplaceService.getMarketplaceStatsEnvelope);

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
  return new NextRequest('http://localhost:3000/api/marketplace/stats', { headers });
}

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
  mockGetMarketplaceStatsEnvelope.mockImplementation(async (correlationId: string) =>
    makeFreshEnvelope({}, 1, correlationId),
  );
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

  it('includes correlationId + timestamp in the 404 body', async () => {
    mockIsFeatureEnabled.mockImplementation((f: string) => f !== 'marketplace');

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(typeof body.error.correlationId).toBe('string');
    expect(typeof body.error.timestamp).toBe('string');
    expect(body.error.timestamp.length).toBeGreaterThan(0);
  });

  it('does not invoke rate limit or cache paths when feature disabled', async () => {
    mockIsFeatureEnabled.mockImplementation((f: string) => f !== 'marketplace');

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

    expect(mockCheckRateLimit).toHaveBeenCalledWith('127.0.0.1', 'api/marketplace/stats');
  });

  it('does not invoke stats envelope after rate limit blocks', async () => {
    mockCheckRateLimit.mockResolvedValue(false);
    const req = makeRequest();
    await GET(req, { params: {} });
    expect(mockGetMarketplaceStatsEnvelope).not.toHaveBeenCalled();
  });
});

describe('GET /api/marketplace/stats — happy path / success', () => {
  it('returns 200 with payload + meta freshness and generation', async () => {
    const env = makeFreshEnvelope({}, 3, 'corr-abc');
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(env);

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.activeListings).toBe(6);
    expect(body.data.averageYield).toBe(12.43);
    expect(body.data.medianPrice).toBe(130000);
    expect(body.meta).toBeDefined();
    expect(body.meta.freshness).toBe('FRESH');
    expect(body.meta.generation).toBe(3);
    expect(body.meta.cacheHit).toBe(true);
    expect(body.meta.state).toBe('FRESH');
    expect(body.meta.fetchedAtIso).toBeTruthy();
    expect(body.meta.sourceCorrelationId).toBe('corr-abc');
  });

  it('emits ETag, X-Cache, X-Stats-Generation, Cache-Control headers on fresh hit', async () => {
    const env = makeFreshEnvelope({}, 1, 'c');
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(env);

    const req = makeRequest();
    const res = await GET(req, { params: {} });

    expect(res.headers.get('ETag')).toBeTruthy();
    expect(res.headers.get('X-Stats-Generation')).toBe('1');
    expect(res.headers.get('X-Stats-State')).toBe('FRESH');
    expect(res.headers.get('X-Cache')).toBeTruthy();
    const cc = res.headers.get('Cache-Control') ?? '';
    expect(cc).toMatch(/public/);
    expect(cc).toMatch(/s-maxage/);
    expect(cc).toMatch(/stale-while-revalidate/);
    expect(cc).toMatch(/stale-if-error/);
  });

  it('returns 304 Not Modified when If-None-Match matches generated ETag', async () => {
    const env = makeFreshEnvelope({}, 5, 'c');
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(env);

    const etag = generateETag({
      payload: env.payload,
      generation: env.lastValidGeneration,
      version: 1,
    });

    const req = makeRequest({ ifNoneMatch: etag });
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(304);
    expect(res.headers.get('ETag')).toBe(etag);
    const text = await res.text();
    expect(text.length).toBe(0);
  });

  it('returns 304 when If-None-Match contains wildcard *', async () => {
    const env = makeFreshEnvelope({}, 1, 'c');
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(env);

    const req = makeRequest({ ifNoneMatch: '*' });
    const res = await GET(req, { params: {} });
    expect(res.status).toBe(304);
  });

  it('correlationId header ties to envelope sourceCorrelationId', async () => {
    mockGetMarketplaceStatsEnvelope.mockImplementation(async (cid: string) =>
      makeFreshEnvelope({}, 1, cid),
    );

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    const headerCid = res.headers.get('x-correlation-id');
    expect(headerCid).toBeTruthy();
    expect(body.meta.sourceCorrelationId).toBe(headerCid);
  });

  it('exposes requestedGeneration <= servedGeneration in meta', async () => {
    memoryStore.set('commitlabs:marketplace:stats:generation', {
      value: 7,
      expiresAt: Date.now() + 999_999,
    });
    const env = makeFreshEnvelope({}, 9, 'c');
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(env);

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(typeof body.meta.requestedGeneration).toBe('number');
    expect(typeof body.meta.servedGeneration).toBe('number');
    expect(body.meta.servedGeneration).toBeGreaterThanOrEqual(body.meta.requestedGeneration);
  });
});

describe('GET /api/marketplace/stats — EMPTY state', () => {
  it('returns EMPTY freshness and MISS_EMPTY cache header', async () => {
    const env: MarketplaceStatsEnvelope = {
      version: 1,
      payload: {
        activeListings: 0,
        averageYield: 0,
        medianPrice: 0,
        typeBreakdown: { Safe: 0, Balanced: 0, Aggressive: 0 },
      },
      fetchedAt: Date.now(),
      expiresAt: Date.now() + 30_000,
      state: 'EMPTY',
      generation: 1,
      lastValidGeneration: 0,
    };
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(env);

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.freshness).toBe('EMPTY');
    expect(body.meta.note).toMatch(/no marketplace listings yet/i);
    expect(res.headers.get('X-Cache')).toBe('MISS_EMPTY');
    expect(res.headers.get('X-Stats-State')).toBe('EMPTY');
  });
});

describe('GET /api/marketplace/stats — stale-if-error / recovery', () => {
  it('serves stale payload when envelope ERROR + retryable, sets Retry-After', async () => {
    const stalePayload = {
      activeListings: 4,
      averageYield: 9.5,
      medianPrice: 90000,
      typeBreakdown: { Safe: 2, Balanced: 1, Aggressive: 1 },
    };
    const env: MarketplaceStatsEnvelope = {
      version: 1,
      payload: stalePayload,
      fetchedAt: Date.now() - 5_000,
      expiresAt: Date.now() + 25_000,
      state: 'ERROR',
      generation: 3,
      lastValidGeneration: 2,
      errorCode: 'SERVICE_UNAVAILABLE',
      errorMessage: 'Upstream chain RPC degraded',
      retryable: true,
      retryAfterSeconds: 30,
      sourceCorrelationId: 'x',
    };
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(env);

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.freshness).toBe('STALE_IF_ERROR');
    expect(body.data.activeListings).toBe(4);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(res.headers.get('X-Cache')).toMatch(/STALE_ERROR/);
    expect(body.meta.note).toMatch(/upstream stats compute failed/i);
  });

  it('returns 5xx when envelope throws and no stale fallback exists', async () => {
    mockGetMarketplaceStatsEnvelope.mockRejectedValue(new Error('Upstream exploded'));
    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();
    expect([503, 500].includes(res.status)).toBe(true);
    expect(body.success).toBe(false);
    expect(body.error.code).toBeTruthy();
  });
});

describe('GET /api/marketplace/stats — invariants enforced (INV-1..INV-PAYLOAD)', () => {
  it('INV-PAYLOAD: rejects envelopes with negative averageYield', async () => {
    const badEnv = makeFreshEnvelope({
      payload: {
        activeListings: 1,
        averageYield: -15,
        medianPrice: 100,
        typeBreakdown: { Safe: 1, Balanced: 0, Aggressive: 0 },
      } as any,
    });
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(badEnv);
    const req = makeRequest();
    const res = await GET(req, { params: {} });
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('INV-2: rejects envelopes with generation < lastValidGeneration', async () => {
    const badEnv = makeFreshEnvelope({ generation: 1, lastValidGeneration: 999 });
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(badEnv);
    const req = makeRequest();
    const res = await GET(req, { params: {} });
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('INV-1: rejects structurally malformed envelopes (wrong version)', async () => {
    const malformed = {
      version: 999,
      payload: null,
      fetchedAt: 0,
      expiresAt: 0,
      state: 'FRESH',
      generation: 1,
      lastValidGeneration: 0,
    } as unknown as MarketplaceStatsEnvelope;
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(malformed);
    const req = makeRequest();
    const res = await GET(req, { params: {} });
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('INV-PAYLOAD: rejects envelopes with negative medianPrice', async () => {
    const badEnv = makeFreshEnvelope({
      payload: {
        activeListings: 1,
        averageYield: 5,
        medianPrice: -1,
        typeBreakdown: { Safe: 1, Balanced: 0, Aggressive: 0 },
      } as any,
    });
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(badEnv);
    const req = makeRequest();
    const res = await GET(req, { params: {} });
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});

describe('GET /api/marketplace/stats — STALE response shaping', () => {
  it('classifies aged envelope as STALE_WHILE_REVALIDATE with ageSeconds > TTL', async () => {
    const oldEnv: MarketplaceStatsEnvelope = {
      ...makeFreshEnvelope({}, 1, 'c'),
      fetchedAt: Date.now() - 60_000,
      expiresAt: Date.now() - 30_000,
      state: 'STALE',
    };
    mockGetMarketplaceStatsEnvelope.mockResolvedValue(oldEnv);

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(body.meta.freshness).toBe('STALE_WHILE_REVALIDATE');
    expect(body.meta.ageSeconds).toBeGreaterThanOrEqual(55);
    expect(res.headers.get('X-Stats-Age')).toBeTruthy();
    expect(Number(res.headers.get('X-Stats-Age'))).toBeGreaterThanOrEqual(55);
  });
});

describe('GET /api/marketplace/stats — request correlation', () => {
  it('forwards a non-empty correlationId string to getMarketplaceStatsEnvelope', async () => {
    let capturedCid = '';
    mockGetMarketplaceStatsEnvelope.mockImplementation(async (cid: string) => {
      capturedCid = cid;
      return makeFreshEnvelope({}, 1, cid);
    });
    const req = makeRequest();
    await GET(req, { params: {} });
    expect(capturedCid.length).toBeGreaterThan(0);
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
