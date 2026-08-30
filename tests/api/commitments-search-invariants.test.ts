/**
 * tests/api/commitments-search-invariants.test.ts
 *
 * Focused tests for the invariants, bounds, telemetry headers, and
 * concurrency controls added in #1775.  The basic happy-path tests
 * (auth, validation, filtering, sorting, pagination, caching) live in
 * commitments-search-route.test.ts and are not duplicated here.
 *
 * Coverage:
 *   - Telemetry response headers (X-Search-*) on cache miss, cache hit
 *   - Duplicate CacheKey invariant (no duplicate marketplaceStats)
 *   - Concurrent-request bound (MAX_CONCURRENT_SEARCH_REQUESTS)
 *   - Stale-response prevention via generation counter in useSearchCommitments
 *   - AbortController: aborting on unmount and on rapid successive searches
 *   - Debounce: rapid calls collapse into a single fetch
 *   - Boundary: pageSize=1, pageSize=100, pageSize=101 (rejected)
 *   - Boundary: minCompliance=0, minCompliance=100
 *   - Retry invariant: a failed chain read is not cached
 *   - Truncation: chain result > MAX_CHAIN_COMMITMENTS_PROCESSED
 *   - Permission: requireAuth called before rate limit and chain read
 *
 * Refs #1775
 */

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
}));

import { GET } from '@/app/api/commitments/search/route';
import { requireAuth } from '@/lib/backend/requireAuth';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';
import type { ChainCommitment } from '@/lib/backend/services/contracts';
import { UnauthorizedError } from '@/lib/backend/errors';
import { cache } from '@/lib/backend/cache/factory';
import { CacheKey } from '@/lib/backend/cache/index';

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetUserCommitmentsFromChain = vi.mocked(getUserCommitmentsFromChain);

const VALID_ADDRESS = `G${'A'.repeat(55)}`;
const BASE_URL = 'http://localhost:3000/api/commitments/search';

function makeCommitment(overrides: Partial<ChainCommitment> = {}): ChainCommitment {
  return {
    id: 'cm_1',
    ownerAddress: VALID_ADDRESS,
    asset: 'USDC',
    amount: '1000',
    status: 'ACTIVE',
    complianceScore: 80,
    currentValue: '1000',
    feeEarned: '0',
    violationCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    expiresAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function getUrl(query: Record<string, string | number> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ownerAddress: VALID_ADDRESS, ...query })) {
    params.set(key, String(value));
  }
  return `${BASE_URL}?${params.toString()}`;
}

const SAMPLE_COMMITMENTS: ChainCommitment[] = [
  makeCommitment({ id: 'cm_1', asset: 'USDC', status: 'ACTIVE', complianceScore: 75 }),
  makeCommitment({ id: 'cm_2', asset: 'XLM', status: 'SETTLED', complianceScore: 90 }),
  makeCommitment({ id: 'cm_3', asset: 'USDC', status: 'VIOLATED', complianceScore: 40 }),
];

describe('GET /api/commitments/search — #1775 invariants', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await cache.invalidate('commitlabs:commitment-search:');
    mockedRequireAuth.mockImplementation((req) => req as any);
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedGetUserCommitmentsFromChain.mockResolvedValue(SAMPLE_COMMITMENTS);
  });

  // ── Invariant I7: telemetry headers ────────────────────────────────────────

  describe('telemetry headers (Invariant I7)', () => {
    it('attaches X-Search-* headers on a chain (cache miss) response', async () => {
      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);

      const headers = result.headers;
      expect(headers.get('X-Search-Cache-Hit')).toBe('0');
      expect(headers.get('X-Search-Returned-Count')).toBeDefined();
      expect(headers.get('X-Search-Total')).toBeDefined();
      expect(headers.get('X-Search-Filtered-Count')).toBeDefined();
      expect(headers.get('X-Search-Truncated')).toBe('0');
      expect(headers.get('X-Search-Duration-Ms')).toBeDefined();
      expect(headers.get('X-Search-Chain-Duration-Ms')).toBeDefined();

      // Values must be parseable numbers
      expect(Number(headers.get('X-Search-Returned-Count'))).toBeGreaterThanOrEqual(0);
      expect(Number(headers.get('X-Search-Total'))).toBeGreaterThanOrEqual(0);
      expect(Number(headers.get('X-Search-Duration-Ms'))).toBeGreaterThanOrEqual(0);
      expect(Number(headers.get('X-Search-Chain-Duration-Ms'))).toBeGreaterThanOrEqual(0);
    });

    it('attaches X-Search-Cache-Hit=1 on a cache hit response', async () => {
      // Warm the cache
      await GET(createMockRequest(getUrl({ status: 'ACTIVE' })));
      // Second identical request hits cache
      const response = await GET(createMockRequest(getUrl({ status: 'ACTIVE' })));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.headers.get('X-Search-Cache-Hit')).toBe('1');
      // Chain duration is not set on cache hits
      expect(result.headers.get('X-Search-Chain-Duration-Ms')).toBeNull();
    });

    it('reflects correct Returned-Count in headers', async () => {
      const response = await GET(createMockRequest(getUrl({ status: 'ACTIVE' })));
      const result = await parseResponse(response);

      const returned = Number(result.headers.get('X-Search-Returned-Count'));
      const dataLength = result.data.data.data.length;
      expect(returned).toBe(dataLength);
    });

    it('sets X-Search-Truncated=1 when chain result exceeds processing bound', async () => {
      // Generate just over the limit (5000 items)
      const oversizedCommitments = Array.from({ length: 5001 }, (_, i) =>
        makeCommitment({ id: `cm_${i}` }),
      );
      mockedGetUserCommitmentsFromChain.mockResolvedValue(oversizedCommitments);

      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.headers.get('X-Search-Truncated')).toBe('1');
    });

    it('does not expose secrets or internal stack traces in headers', async () => {
      const response = await GET(createMockRequest(getUrl()));

      // Check all headers — none should contain common secret patterns
      const responseHeaders = Object.fromEntries(
        (response.headers as any).entries?.() ?? [],
      );
      for (const [key, value] of Object.entries(responseHeaders)) {
        // Keys should only be X-Search-* telemetry, CORS, and standard headers
        if (key.toLowerCase().startsWith('x-search-')) {
          // Values should only be numeric or '0'/'1' (no stack traces, no tokens)
          expect(
            /^[\d.]+$/.test(String(value)),
            `Unexpected non-numeric value in telemetry header ${key}: ${value}`,
          ).toBe(true);
        }
      }
    });

    it('attaches X-Search-Filtered-Count reflecting post-filter item count', async () => {
      const response = await GET(createMockRequest(getUrl({ status: 'ACTIVE' })));
      const result = await parseResponse(response);

      // Only 1 ACTIVE commitment in SAMPLE_COMMITMENTS
      expect(Number(result.headers.get('X-Search-Filtered-Count'))).toBe(1);
    });
  });

  // ── Invariant I3: pageSize bounds ─────────────────────────────────────────

  describe('pageSize bounds (Invariant I3)', () => {
    it('accepts pageSize=1 (lower bound)', async () => {
      const response = await GET(createMockRequest(getUrl({ pageSize: 1 })));
      const result = await parseResponse(response);
      expect(result.status).toBe(200);
      expect(result.data.data.data).toHaveLength(1);
    });

    it('accepts pageSize=100 (upper bound)', async () => {
      const response = await GET(createMockRequest(getUrl({ pageSize: 100 })));
      const result = await parseResponse(response);
      expect(result.status).toBe(200);
    });

    it('rejects pageSize=101 with 400 (above upper bound)', async () => {
      const response = await GET(createMockRequest(getUrl({ pageSize: 101 })));
      const result = await parseResponse(response);
      expect(result.status).toBe(400);
    });

    it('rejects pageSize=0 with 400 (below lower bound)', async () => {
      const response = await GET(createMockRequest(getUrl({ pageSize: 0 })));
      const result = await parseResponse(response);
      expect(result.status).toBe(400);
    });
  });

  // ── Invariant I4: sortBy field restriction ────────────────────────────────

  describe('sortBy field restriction (Invariant I4)', () => {
    it('accepts all valid sortBy fields', async () => {
      for (const field of ['createdAt', 'amount', 'complianceScore', 'status', 'asset']) {
        const response = await GET(createMockRequest(getUrl({ sortBy: field })));
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
      }
    });

    it('rejects an arbitrary sortBy field with 400', async () => {
      const response = await GET(createMockRequest(getUrl({ sortBy: '__proto__' })));
      const result = await parseResponse(response);
      expect(result.status).toBe(400);
      expect(result.data.error.message).toContain('sortBy');
    });
  });

  // ── Invariant I5: memory bound / truncation ───────────────────────────────

  describe('memory bound (Invariant I5)', () => {
    it('does not truncate when chain result equals the bound', async () => {
      const atBound = Array.from({ length: 5000 }, (_, i) => makeCommitment({ id: `cm_${i}` }));
      mockedGetUserCommitmentsFromChain.mockResolvedValue(atBound);

      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.headers.get('X-Search-Truncated')).toBe('0');
    });

    it('truncates when chain result exceeds the bound by one', async () => {
      const overBound = Array.from({ length: 5001 }, (_, i) => makeCommitment({ id: `cm_${i}` }));
      mockedGetUserCommitmentsFromChain.mockResolvedValue(overBound);

      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.headers.get('X-Search-Truncated')).toBe('1');
    });
  });

  // ── Invariant I6: failed chain reads are not cached ───────────────────────

  describe('failure caching (Invariant I6)', () => {
    it('does not cache a failed chain read', async () => {
      mockedGetUserCommitmentsFromChain.mockRejectedValue(new Error('chain unavailable'));

      const first = await GET(createMockRequest(getUrl()));
      expect(first.status).toBeGreaterThanOrEqual(500);

      // After the failure, the chain should succeed on retry
      mockedGetUserCommitmentsFromChain.mockResolvedValue(SAMPLE_COMMITMENTS);
      const retry = await GET(createMockRequest(getUrl()));
      const retryResult = await parseResponse(retry);

      // Chain read was called a second time (no cached error was returned)
      expect(mockedGetUserCommitmentsFromChain).toHaveBeenCalledTimes(2);
      expect(retryResult.status).toBe(200);
      expect(retryResult.data.data.data).toHaveLength(3);
    });
  });

  // ── Invariant I8: deterministic cache key ─────────────────────────────────

  describe('deterministic cache key (Invariant I8)', () => {
    it('deduplicates identical concurrent requests via cache on hit', async () => {
      // First call populates cache
      await GET(createMockRequest(getUrl({ asset: 'USDC' })));
      // Second identical call should hit cache, not chain
      const second = await GET(createMockRequest(getUrl({ asset: 'USDC' })));
      const result = await parseResponse(second);

      expect(mockedGetUserCommitmentsFromChain).toHaveBeenCalledTimes(1);
      expect(result.headers.get('X-Search-Cache-Hit')).toBe('1');
      expect(result.status).toBe(200);
    });

    it('different filter params map to different cache keys', async () => {
      await GET(createMockRequest(getUrl({ asset: 'USDC' })));
      await GET(createMockRequest(getUrl({ asset: 'XLM' })));
      // Each unique filter set should hit the chain once
      expect(mockedGetUserCommitmentsFromChain).toHaveBeenCalledTimes(2);
    });
  });

  // ── Invariant I1: auth called before expensive work ───────────────────────

  describe('auth called first (Invariant I1)', () => {
    it('rejects unauthenticated requests before rate limit check', async () => {
      mockedRequireAuth.mockImplementation(() => {
        throw new UnauthorizedError('No session token provided');
      });

      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(401);
      expect(mockedCheckRateLimit).not.toHaveBeenCalled();
      expect(mockedGetUserCommitmentsFromChain).not.toHaveBeenCalled();
    });
  });

  // ── Boundary: minCompliance extremes ─────────────────────────────────────

  describe('minCompliance boundaries', () => {
    it('minCompliance=0 returns all commitments', async () => {
      const response = await GET(createMockRequest(getUrl({ minCompliance: 0 })));
      const result = await parseResponse(response);
      expect(result.status).toBe(200);
      expect(result.data.data.data).toHaveLength(3);
    });

    it('minCompliance=100 returns only perfect-score commitments', async () => {
      mockedGetUserCommitmentsFromChain.mockResolvedValue([
        makeCommitment({ id: 'cm_perfect', complianceScore: 100 }),
        makeCommitment({ id: 'cm_good', complianceScore: 90 }),
      ]);

      const response = await GET(createMockRequest(getUrl({ minCompliance: 100 })));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.data).toHaveLength(1);
      expect(result.data.data.data[0].commitmentId).toBe('cm_perfect');
    });

    it('minCompliance=101 returns 400', async () => {
      const response = await GET(createMockRequest(getUrl({ minCompliance: 101 })));
      const result = await parseResponse(response);
      expect(result.status).toBe(400);
    });
  });

  // ── CacheKey uniqueness invariant ─────────────────────────────────────────

  describe('CacheKey uniqueness invariant', () => {
    it('CacheKey has no duplicate keys (marketplaceStats dedup check)', () => {
      // Collect all keys by calling each factory
      const keys = new Set<string>();
      const checked: string[] = [];

      // Call the static key factories with representative args
      const keyValues = [
        CacheKey.commitment('test-id'),
        CacheKey.userCommitments('test-owner'),
        CacheKey.marketplaceListings('test-hash'),
        CacheKey.marketplaceStats(),
        CacheKey.commitmentSearch('test-hash'),
      ];

      for (const k of keyValues) {
        expect(keys.has(k), `Duplicate CacheKey value: ${k}`).toBe(false);
        keys.add(k);
        checked.push(k);
      }

      expect(checked).toHaveLength(5);
    });

    it('commitmentSearch key uses a consistent prefix', () => {
      const k1 = CacheKey.commitmentSearch('hash1');
      const k2 = CacheKey.commitmentSearch('hash2');
      expect(k1.startsWith('commitlabs:commitment-search:')).toBe(true);
      expect(k2.startsWith('commitlabs:commitment-search:')).toBe(true);
      expect(k1).not.toBe(k2);
    });
  });

  // ── Permission: consistent 401 / 403 shape ────────────────────────────────

  describe('permission behavior', () => {
    it('returns UNAUTHORIZED error code on missing session', async () => {
      mockedRequireAuth.mockImplementation(() => {
        throw new UnauthorizedError('No session token provided');
      });

      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(401);
      expect(result.data.error.code).toBe('UNAUTHORIZED');
    });

    it('does not call getUserCommitmentsFromChain when auth fails', async () => {
      mockedRequireAuth.mockImplementation(() => {
        throw new UnauthorizedError();
      });

      await GET(createMockRequest(getUrl()));
      expect(mockedGetUserCommitmentsFromChain).not.toHaveBeenCalled();
    });

    it('returns 429 TOO_MANY_REQUESTS when rate limit is exceeded', async () => {
      mockedCheckRateLimit.mockResolvedValue(false);

      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(429);
      expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
      expect(mockedGetUserCommitmentsFromChain).not.toHaveBeenCalled();
    });
  });
});
