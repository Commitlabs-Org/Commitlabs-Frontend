// src/app/api/analytics/user/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/config', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
}));

const { getUserCommitmentsFromChain } = await import('@/lib/backend/services/contracts');
const { isFeatureEnabled } = await import('@/lib/backend/config');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const MOCK_COMMITMENTS = [
  {
    id: 'c1',
    ownerAddress: OWNER_ADDRESS,
    asset: 'XLM',
    amount: '100',
    status: 'ACTIVE',
    complianceScore: 80,
    currentValue: '110',
    feeEarned: '5',
    violationCount: 1,
  },
  {
    id: 'c2',
    ownerAddress: OWNER_ADDRESS,
    asset: 'XLM',
    amount: '200',
    status: 'CREATED',
    complianceScore: 90,
    currentValue: '210',
    feeEarned: '10',
    violationCount: 0,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/analytics/user');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString(), { method: 'GET' });
}

// ─── GET /api/analytics/user — success ───────────────────────────────────────

describe('GET /api/analytics/user — success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
  });

  it('returns 200 with correct analytics shape for multiple commitments', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue(MOCK_COMMITMENTS);
    const req = makeRequest({ ownerAddress: OWNER_ADDRESS });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ownerAddress).toBe(OWNER_ADDRESS);
    expect(body.totalCommitments).toBe(2);
    expect(body.activeCommitments).toBe(1);
    expect(body.totalValueCommitted).toBe('300.00');
    expect(body.feesEarned).toBe('15.00');
    expect(body.averageComplianceScore).toBe(85);
    expect(body.violationCount).toBe(1);
  });

  it('returns zeroed analytics when no commitments exist for user', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);
    const req = makeRequest({ ownerAddress: OWNER_ADDRESS });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ownerAddress).toBe(OWNER_ADDRESS);
    expect(body.totalCommitments).toBe(0);
    expect(body.activeCommitments).toBe(0);
    expect(body.totalValueCommitted).toBe('0.00');
    expect(body.feesEarned).toBe('0.00');
    expect(body.averageComplianceScore).toBe(0);
    expect(body.violationCount).toBe(0);
  });

  it('trims whitespace from ownerAddress query param', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);
    const url = new URL('http://localhost:3000/api/analytics/user');
    url.searchParams.set('ownerAddress', `  ${OWNER_ADDRESS}  `);
    const req = new NextRequest(url.toString(), { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getUserCommitmentsFromChain).toHaveBeenCalledWith(OWNER_ADDRESS);
  });

  it('returns correct content-type header', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);
    const req = makeRequest({ ownerAddress: OWNER_ADDRESS });
    const res = await GET(req);

    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});

// ─── GET /api/analytics/user — input validation ───────────────────────────────

describe('GET /api/analytics/user — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
  });

  it('returns 400 when ownerAddress query param is missing', async () => {
    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toMatch(/ownerAddress/);
  });

  it('returns 400 when ownerAddress is blank/whitespace-only', async () => {
    const req = makeRequest({ ownerAddress: '   ' });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});

// ─── GET /api/analytics/user — feature flag disabled ─────────────────────────

describe('GET /api/analytics/user — feature flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when analyticsUser feature flag is disabled', async () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    const req = makeRequest({ ownerAddress: OWNER_ADDRESS });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toMatch(/disabled/i);
  });

  it('returns 404 error details containing feature name', async () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    const req = makeRequest({ ownerAddress: OWNER_ADDRESS });
    const res = await GET(req);
    const body = await res.json();

    expect(body.error.details).toMatchObject({ feature: 'analyticsUser' });
  });
});

// ─── GET /api/analytics/user — upstream failure ───────────────────────────────

describe('GET /api/analytics/user — upstream errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
  });

  it('returns 500 when getUserCommitmentsFromChain throws an unexpected error', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockRejectedValue(new Error('chain rpc timeout'));
    const req = makeRequest({ ownerAddress: OWNER_ADDRESS });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toMatch(/user analytics/i);
  });
});
