import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';

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
import { UnauthorizedError, ForbiddenError } from '@/lib/backend/errors';
import { cache } from '@/lib/backend/cache/factory';

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetUserCommitmentsFromChain = vi.mocked(getUserCommitmentsFromChain);

const VALID_ADDRESS = `G${'A'.repeat(55)}`;
const BASE_URL = 'http://localhost:3000/api/commitments/search';

function commitment(overrides: Partial<ChainCommitment>): ChainCommitment {
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

const CHEAP_OLD = commitment({
  id: 'cm_cheap_old',
  amount: '100',
  complianceScore: 60,
  status: 'ACTIVE',
  asset: 'XLM',
  createdAt: '2024-01-01T00:00:00Z',
});
const MID_NEW = commitment({
  id: 'cm_mid_new',
  amount: '500',
  complianceScore: 90,
  status: 'SETTLED',
  asset: 'USDC',
  createdAt: '2024-06-01T00:00:00Z',
});
const EXPENSIVE_MID = commitment({
  id: 'cm_expensive_mid',
  amount: '900',
  complianceScore: 75,
  status: 'ACTIVE',
  asset: 'USDC',
  createdAt: '2024-03-01T00:00:00Z',
});

const ALL_COMMITMENTS = [CHEAP_OLD, MID_NEW, EXPENSIVE_MID];

function getUrl(query: Record<string, string | number> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ownerAddress: VALID_ADDRESS, ...query })) {
    params.set(key, String(value));
  }
  return `${BASE_URL}?${params.toString()}`;
}

describe('GET /api/commitments/search', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // MemoryAdapter has no cross-test reset hook; clear via wildcard prefix
    // so cached results from one test don't leak visibility into the next.
    await cache.invalidate('commitlabs:commitment-search:');
    // Return a mock authenticated request whose `.user.address` matches the
    // VALID_ADDRESS used in all default requests. Tests that need to verify
    // scope enforcement (403) override this mock locally.
    mockedRequireAuth.mockImplementation((req) =>
      Object.assign(req, { user: { address: VALID_ADDRESS, csrfToken: 'tok' } }) as any,
    );
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedGetUserCommitmentsFromChain.mockResolvedValue(ALL_COMMITMENTS);
  });

  describe('authorization', () => {
    it('returns 401 when the caller has no valid session', async () => {
      mockedRequireAuth.mockImplementation(() => {
        throw new UnauthorizedError('No session token provided');
      });

      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(401);
      expect(result.data.error.code).toBe('UNAUTHORIZED');
      expect(mockedGetUserCommitmentsFromChain).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('returns 400 when ownerAddress is missing', async () => {
      const response = await GET(createMockRequest(`${BASE_URL}?page=1`));
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for an invalid status enum value', async () => {
      const response = await GET(createMockRequest(getUrl({ status: 'NOT_A_STATUS' })));
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for an invalid riskType enum value', async () => {
      const response = await GET(createMockRequest(getUrl({ riskType: 'Reckless' })));
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
    });

    it('returns 400 when pageSize exceeds the bound', async () => {
      const response = await GET(createMockRequest(getUrl({ pageSize: 500 })));
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for a non-integer page', async () => {
      const response = await GET(createMockRequest(getUrl({ page: '1.5' })));
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
    });

    it('returns 400 for an unsupported sortBy field', async () => {
      const response = await GET(createMockRequest(getUrl({ sortBy: 'ownerAddress' })));
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.message).toContain('sortBy');
    });

    it('returns 400 for an invalid sortOrder value', async () => {
      const response = await GET(createMockRequest(getUrl({ sortOrder: 'sideways' })));
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
    });
  });

  describe('filtering', () => {
    it('filters by asset case-insensitively', async () => {
      const response = await GET(createMockRequest(getUrl({ asset: 'usdc' })));
      const result = await parseResponse(response);

      expect(result.data.data.data).toHaveLength(2);
      expect(result.data.data.data.every((c: any) => c.asset === 'USDC')).toBe(true);
    });

    it('filters by status', async () => {
      const response = await GET(createMockRequest(getUrl({ status: 'SETTLED' })));
      const result = await parseResponse(response);

      expect(result.data.data.data).toHaveLength(1);
      expect(result.data.data.data[0].commitmentId).toBe('cm_mid_new');
    });

    it('filters by commitmentId substring, case-insensitively', async () => {
      const response = await GET(createMockRequest(getUrl({ commitmentId: 'CHEAP' })));
      const result = await parseResponse(response);

      expect(result.data.data.data).toHaveLength(1);
      expect(result.data.data.data[0].commitmentId).toBe('cm_cheap_old');
    });

    it('filters by minCompliance', async () => {
      const response = await GET(createMockRequest(getUrl({ minCompliance: 80 })));
      const result = await parseResponse(response);

      expect(result.data.data.data).toHaveLength(1);
      expect(result.data.data.data[0].commitmentId).toBe('cm_mid_new');
    });

    it('combines multiple filters', async () => {
      const response = await GET(createMockRequest(getUrl({ asset: 'USDC', status: 'ACTIVE' })));
      const result = await parseResponse(response);

      expect(result.data.data.data).toHaveLength(1);
      expect(result.data.data.data[0].commitmentId).toBe('cm_expensive_mid');
    });

    it('reports applied filters in the response metadata', async () => {
      const response = await GET(createMockRequest(getUrl({ asset: 'USDC' })));
      const result = await parseResponse(response);

      expect(result.data.data.filters).toMatchObject({
        asset: 'USDC',
        status: null,
        riskType: null,
      });
    });
  });

  describe('sorting', () => {
    it('sorts by amount ascending', async () => {
      const response = await GET(createMockRequest(getUrl({ sortBy: 'amount', sortOrder: 'asc' })));
      const result = await parseResponse(response);

      expect(result.data.data.data.map((c: any) => c.commitmentId)).toEqual([
        'cm_cheap_old',
        'cm_mid_new',
        'cm_expensive_mid',
      ]);
    });

    it('sorts by amount descending', async () => {
      const response = await GET(
        createMockRequest(getUrl({ sortBy: 'amount', sortOrder: 'desc' })),
      );
      const result = await parseResponse(response);

      expect(result.data.data.data.map((c: any) => c.commitmentId)).toEqual([
        'cm_expensive_mid',
        'cm_mid_new',
        'cm_cheap_old',
      ]);
    });

    it('defaults to createdAt descending when no sort is specified', async () => {
      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.data.data.data.map((c: any) => c.commitmentId)).toEqual([
        'cm_mid_new',
        'cm_expensive_mid',
        'cm_cheap_old',
      ]);
    });

    it('breaks ties on commitmentId for a stable order', async () => {
      mockedGetUserCommitmentsFromChain.mockResolvedValue([
        commitment({ id: 'cm_b', amount: '500', createdAt: '2024-01-01T00:00:00Z' }),
        commitment({ id: 'cm_a', amount: '500', createdAt: '2024-01-01T00:00:00Z' }),
      ]);

      const response = await GET(createMockRequest(getUrl({ sortBy: 'amount', sortOrder: 'asc' })));
      const result = await parseResponse(response);

      expect(result.data.data.data.map((c: any) => c.commitmentId)).toEqual(['cm_a', 'cm_b']);
    });
  });

  describe('pagination', () => {
    it('paginates results', async () => {
      const page1 = await parseResponse(
        await GET(createMockRequest(getUrl({ page: 1, pageSize: 2 }))),
      );
      expect(page1.data.data.data).toHaveLength(2);
      expect(page1.data.data.meta).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });

      const page2 = await parseResponse(
        await GET(createMockRequest(getUrl({ page: 2, pageSize: 2 }))),
      );
      expect(page2.data.data.data).toHaveLength(1);
    });

    it('returns an empty page (not an error) past the last page', async () => {
      const response = await GET(createMockRequest(getUrl({ page: 99, pageSize: 10 })));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.data).toHaveLength(0);
      expect(result.data.data.meta.total).toBe(3);
    });
  });

  describe('empty states', () => {
    it('returns an empty result set when the owner has no commitments', async () => {
      mockedGetUserCommitmentsFromChain.mockResolvedValue([]);

      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.data).toHaveLength(0);
      expect(result.data.data.meta.total).toBe(0);
      expect(result.data.data.meta.totalPages).toBe(0);
    });

    it('returns an empty result set when filters match nothing', async () => {
      const response = await GET(createMockRequest(getUrl({ asset: 'BTC' })));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.data).toHaveLength(0);
    });
  });

  describe('failure behavior', () => {
    it('returns 429 when rate limited, without reading the chain', async () => {
      mockedCheckRateLimit.mockResolvedValue(false);

      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(429);
      expect(mockedGetUserCommitmentsFromChain).not.toHaveBeenCalled();
    });

    it('propagates a chain read failure as a 5xx without caching it', async () => {
      mockedGetUserCommitmentsFromChain.mockRejectedValue(new Error('chain unavailable'));

      const response = await GET(createMockRequest(getUrl()));
      expect(response.status).toBeGreaterThanOrEqual(500);

      // A second, identical request should still hit the chain (nothing
      // was cached from the failed attempt) rather than replaying a
      // cached error.
      mockedGetUserCommitmentsFromChain.mockResolvedValue(ALL_COMMITMENTS);
      const retry = await GET(createMockRequest(getUrl()));
      const retryResult = await parseResponse(retry);
      expect(retryResult.status).toBe(200);
    });
  });

  describe('caching', () => {
    it('serves a repeated identical query from cache without re-reading the chain', async () => {
      await GET(createMockRequest(getUrl({ status: 'ACTIVE' })));
      expect(mockedGetUserCommitmentsFromChain).toHaveBeenCalledTimes(1);

      const response = await GET(createMockRequest(getUrl({ status: 'ACTIVE' })));
      const result = await parseResponse(response);

      expect(mockedGetUserCommitmentsFromChain).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(200);
      expect(result.data.data.data).toHaveLength(2);
    });

    it('treats a different query (different filters) as a cache miss', async () => {
      await GET(createMockRequest(getUrl({ status: 'ACTIVE' })));
      await GET(createMockRequest(getUrl({ status: 'SETTLED' })));

      expect(mockedGetUserCommitmentsFromChain).toHaveBeenCalledTimes(2);
    });
  });

  // ─── New: scope enforcement (issue #1775) ────────────────────────────────────
  describe('permission / scope enforcement', () => {
    it('returns 403 when the authenticated address does not match ownerAddress', async () => {
      // Auth succeeds but the authenticated wallet is a different address.
      const OTHER_ADDRESS = `G${'B'.repeat(55)}`;
      mockedRequireAuth.mockImplementation((req) =>
        Object.assign(req, { user: { address: OTHER_ADDRESS, csrfToken: 'tok' } }) as any,
      );

      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(403);
      expect(result.data.error.code).toBe('FORBIDDEN');
      expect(result.data.error.message).toContain('ownerAddress');
      // Should not have read from chain.
      expect(mockedGetUserCommitmentsFromChain).not.toHaveBeenCalled();
    });

    it('returns 200 when the authenticated address exactly matches ownerAddress', async () => {
      // Default mock already sets address = VALID_ADDRESS; this test
      // makes the contract explicit.
      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(mockedGetUserCommitmentsFromChain).toHaveBeenCalledTimes(1);
    });

    it('scope check fires after auth and rate-limit but before chain work', async () => {
      const OTHER_ADDRESS = `G${'C'.repeat(55)}`;
      mockedRequireAuth.mockImplementation((req) =>
        Object.assign(req, { user: { address: OTHER_ADDRESS, csrfToken: 'tok' } }) as any,
      );

      await GET(createMockRequest(getUrl()));

      // Chain must not be invoked when the scope check fails.
      expect(mockedGetUserCommitmentsFromChain).not.toHaveBeenCalled();
    });
  });

  // ─── New: structured diagnostics (issue #1775) ───────────────────────────────
  describe('structured diagnostics', () => {
    it('includes a diagnostics object in every successful response', async () => {
      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.diagnostics).toMatchObject({
        servedFromCache: false,
        responseLatencyMs: expect.any(Number),
        chainLatencyMs: expect.any(Number),
        filterLatencyMs: expect.any(Number),
        rawCount: expect.any(Number),
        filteredCount: expect.any(Number),
        returnedCount: expect.any(Number),
        truncated: expect.any(Boolean),
      });
    });

    it('diagnostics.servedFromCache is true when the response was cached', async () => {
      // First request primes the cache.
      await GET(createMockRequest(getUrl({ status: 'ACTIVE' })));

      // Second identical request should hit the cache.
      const response = await GET(createMockRequest(getUrl({ status: 'ACTIVE' })));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.diagnostics.servedFromCache).toBe(true);
    });

    it('diagnostics.rawCount reflects total commitments from chain before filtering', async () => {
      const response = await GET(createMockRequest(getUrl({ status: 'SETTLED' })));
      const result = await parseResponse(response);

      // ALL_COMMITMENTS has 3 entries; only one matches SETTLED.
      expect(result.data.data.diagnostics.rawCount).toBe(3);
      expect(result.data.data.diagnostics.filteredCount).toBe(1);
      expect(result.data.data.diagnostics.returnedCount).toBe(1);
    });

    it('diagnostics.responseLatencyMs is a non-negative number', async () => {
      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.data.data.diagnostics.responseLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('diagnostics.truncated is false when chain result is within bounds', async () => {
      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);

      expect(result.data.data.diagnostics.truncated).toBe(false);
    });

    it('does not include secrets, stack traces, or internal paths in diagnostics', async () => {
      const response = await GET(createMockRequest(getUrl()));
      const result = await parseResponse(response);
      const diagStr = JSON.stringify(result.data.data.diagnostics);

      // Ensure none of the sensitive patterns appear.
      expect(diagStr).not.toMatch(/password|secret|token|key|stack|Error:/i);
    });
  });

  // ─── New: minCompliance boundary (issue #1775) ───────────────────────────────
  describe('minCompliance boundary enforcement', () => {
    it('returns 400 when minCompliance exceeds 100', async () => {
      const response = await GET(createMockRequest(getUrl({ minCompliance: 101 })));
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when minCompliance is negative', async () => {
      const response = await GET(createMockRequest(getUrl({ minCompliance: -1 })));
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts minCompliance of exactly 0', async () => {
      const response = await GET(createMockRequest(getUrl({ minCompliance: 0 })));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      // All commitments pass the 0% threshold.
      expect(result.data.data.data).toHaveLength(3);
    });

    it('accepts minCompliance of exactly 100', async () => {
      const response = await GET(createMockRequest(getUrl({ minCompliance: 100 })));
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      // None of the test fixtures reach 100%.
      expect(result.data.data.data).toHaveLength(0);
    });
  });

  // ─── New: pagination parse error includes correlationId (issue #1775) ────────
  describe('pagination error response', () => {
    it('includes a correlationId in the error when sortBy is invalid', async () => {
      const req = createMockRequest(getUrl({ sortBy: 'nonExistentField' }));
      req.headers.set('x-correlation-id', 'test-corr-id-123');
      const response = await GET(req);
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      // The correlation header should be forwarded regardless of error type.
      expect(response.headers.get('x-correlation-id')).toBeTruthy();
    });
  });
});