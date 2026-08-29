import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { generateETag } from '@/lib/backend/etag';

const memoryStore = new Map<string, { value: unknown; expiresAt: number }>();

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/backend/config', () => ({
  isFeatureEnabled: vi.fn((feature: string) => {
    if (feature === 'marketplace') return true;
    if (feature === 'marketplaceMockData') return true;
    return false;
  }),
}));

vi.mock('@/lib/backend/cache/factory', () => ({
  cache: {
    get: vi.fn(async <T>(key: string): Promise<T | null> => {
      const entry = memoryStore.get(key) as { value: T; expiresAt: number } | undefined;
      if (!entry) return null as unknown as T;
      if (Date.now() > entry.expiresAt) {
        memoryStore.delete(key);
        return null as unknown as T;
      }
      return entry.value;
    }),
    set: vi.fn(async <T>(key: string, value: T, ttlSeconds: number): Promise<void> => {
      memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }),
    delete: vi.fn(async (key: string): Promise<void> => {
      memoryStore.delete(key);
    }),
    invalidate: vi.fn(async (prefix: string): Promise<void> => {
      for (const key of Array.from(memoryStore.keys())) {
        if (key.startsWith(prefix)) memoryStore.delete(key);
      }
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

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockCache = vi.mocked(cache);
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled);
const mockGetMarketplaceStatsEnvelope = vi.mocked(marketplaceService.getMarketplaceStatsEnvelope);

function makeFreshEnvelope(
  overrides: Partial<MarketplaceStatsEnvelope> = {},
  generation = 1,
  correlationId = 'test-correlation',
): MarketplaceStatsEnvelope {
  const base = makeStatsEnvelope(
    {
      activeListings: 6,
      averageYield: 12.43,
      medianPrice: 130000,
      typeBreakdown: { Safe: 2, Balanced: 2, Aggressive: 2 },
      ...((overrides.payload ?? {}) as Partial<MarketplaceStatsEnvelope['payload']>),
    },
    generation,
    overrides.state ?? 'FRESH',
    30,
    correlationId,
  );
  return { ...base, ...overrides };
}

function makeRequest(options: { ifNoneMatch?: string } = {}): NextRequest {
  const headers = new Headers({
    'x-forwarded-for': '127.0.0.1',
    ...(options.ifNoneMatch ? { 'if-none-match': options.ifNoneMatch } : {}),
  });
  return new NextRequest('http://localhost:3000/api/marketplace/stats', { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  memoryStore.clear();
  mockCheckRateLimit.mockResolvedValue(true);
  mockIsFeatureEnabled.mockImplementation((f: string) => {
    if (f === 'marketplace') return true;
    if (f === 'marketplaceMockData') return true;
    return false;
  });
  mockGetMarketplaceStatsEnvelope.mockImplementation(async (correlationId: string) =>
    makeFreshEnvelope({}, 1, correlationId),
  );
});

describe('GET /api/marketplace/stats — feature flag / permission', () => {
  it('returns 404 NOT_FOUND when marketplace feature is disabled', async () => {
    mockIsFeatureEnabled.mockImplementation((f: string) => f !== 'marketplace');

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toMatch(/disabled/i);
    expect(body.error.details.feature).toBe('marketplace');
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
    await GET(req, { params: {} });

    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockCache.get).not.toHaveBeenCalled();
  });
});

describe('GET /api/marketplace/stats — rate limiting', () => {
  it('returns 429 TOO_MANY_REQUESTS when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
    const res = await GET(req, { params: {} });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(body.error.retryAfterSeconds).toBe(60);
  });

  it('sets x-correlation-id and x-request-id headers on 429', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
    const res = await GET(req, { params: {} });

    expect(res.headers.get('x-correlation-id')).toBeTruthy();
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('calls checkRateLimit with the correct routeId and IP', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = makeRequest();
    await GET(req, { params: {} });

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
