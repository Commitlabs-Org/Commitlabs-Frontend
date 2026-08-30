import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/cache/factory', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
}));

import { cache } from '@/lib/backend/cache/factory';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { requireAuth } from '@/lib/backend/requireAuth';
import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';

const mockCache = vi.mocked(cache);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockRequireAuth = vi.mocked(requireAuth);
const mockGetUserCommitmentsFromChain = vi.mocked(getUserCommitmentsFromChain);

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/commitments/search?${query}`, {
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });
}

function chainCommitment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cmt-1',
    ownerAddress: 'GOWNER',
    asset: 'USDC',
    amount: '100',
    status: 'ACTIVE',
    complianceScore: 90,
    currentValue: '100',
    feeEarned: '1',
    violationCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('GET /api/commitments/search', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAuth.mockReturnValue({
      user: { address: 'GOWNER', csrfToken: 'csrf' },
    } as ReturnType<typeof requireAuth>);
    mockCheckRateLimit.mockResolvedValue(true);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockGetUserCommitmentsFromChain.mockResolvedValue([
      chainCommitment({ id: 'b', amount: '200', createdAt: '2026-01-02T00:00:00.000Z' }),
      chainCommitment({ id: 'a', amount: '100', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]);
  });

  it('returns sorted, filtered results with explicit invariants', async () => {
    const res = await GET(
      makeRequest('ownerAddress=GOWNER&asset=usdc&sortBy=amount&sortOrder=asc&page=1&pageSize=10'),
      { params: {} },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.data.map((item: { commitmentId: string }) => item.commitmentId)).toEqual([
      'a',
      'b',
    ]);
    expect(body.data.invariants).toMatchObject({
      authorizedOwner: true,
      stableSort: true,
      boundedPage: true,
      duplicateCommitmentsRemoved: true,
    });
    expect(body.data.snapshot.rawCount).toBe(2);
    expect(body.data.snapshot.rejectedRecords).toBe(0);
  });

  it('rejects searches for a different wallet before chain work', async () => {
    const res = await GET(makeRequest('ownerAddress=GOTHER'), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(mockGetUserCommitmentsFromChain).not.toHaveBeenCalled();
  });

  it('drops malformed and duplicate records without corrupting pagination totals', async () => {
    mockGetUserCommitmentsFromChain.mockResolvedValue([
      chainCommitment({ id: 'same', amount: '10' }),
      chainCommitment({ id: 'same', amount: '20' }),
      chainCommitment({ id: 'bad-score', complianceScore: 101 }),
      chainCommitment({ id: '', amount: '30' }),
    ]);

    const res = await GET(makeRequest('ownerAddress=GOWNER&page=1&pageSize=10'), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.data).toHaveLength(1);
    expect(body.data.meta.total).toBe(1);
    expect(body.data.snapshot.rejectedRecords).toBe(2);
    expect(body.data.snapshot.duplicateRecords).toBe(1);
  });

  it('serves canonical cached results for equivalent query casing', async () => {
    mockCache.get.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      filters: { asset: 'USDC' },
      snapshot: { queryKey: 'cached', source: 'chain' },
      invariants: { authorizedOwner: true },
    });

    const res = await GET(makeRequest('ownerAddress=gowner&asset=usdc'), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.snapshot.source).toBe('cache');
    expect(mockGetUserCommitmentsFromChain).not.toHaveBeenCalled();
  });

  it('returns validation errors for adversarial query boundaries', async () => {
    const res = await GET(makeRequest('ownerAddress=GOWNER&minCompliance=101'), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
