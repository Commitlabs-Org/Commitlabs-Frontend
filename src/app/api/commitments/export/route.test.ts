import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/auth', () => ({
  verifySessionToken: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { verifySessionToken } from '@/lib/backend/auth';
import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';
import { GET } from './route';

const OWNER = 'gowneraddress';

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/commitments/export?${query}`, {
    headers: { authorization: 'Bearer test-token' },
  });
}

function commitment(overrides: Partial<{ id: string; createdAt: string }> = {}) {
  return {
    id: overrides.id ?? 'commitment-1',
    ownerAddress: OWNER,
    asset: 'XLM',
    amount: '100',
    status: 'ACTIVE' as const,
    complianceScore: 100,
    currentValue: '100',
    feeEarned: '0',
    violationCount: 0,
    createdAt: overrides.createdAt,
    expiresAt: undefined,
  };
}

async function readCsvBody(res: Response): Promise<string> {
  return await res.text();
}

describe('GET /api/commitments/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: OWNER });
  });

  it('rejects an unsupported export format with 400', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([commitment()]);

    const res = await GET(makeRequest(`ownerAddress=${OWNER}&format=json`), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toContain('json');
  });

  it('defaults to csv when no format is specified', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([commitment()]);

    const res = await GET(makeRequest(`ownerAddress=${OWNER}`), { params: {} });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
  });

  it('excludes commitments created before the requested date range cutoff', async () => {
    const now = new Date('2026-06-15T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([
      commitment({ id: 'recent', createdAt: '2026-06-10T00:00:00.000Z' }),
      commitment({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]);

    const res = await GET(
      makeRequest(`ownerAddress=${OWNER}&dateRange=7d&columns=Commitment ID`),
      { params: {} },
    );
    const csv = await readCsvBody(res);

    expect(csv).toContain('recent');
    expect(csv).not.toContain('old');

    vi.useRealTimers();
  });

  it('includes all commitments when dateRange is "all" or omitted', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([
      commitment({ id: 'recent', createdAt: '2026-06-10T00:00:00.000Z' }),
      commitment({ id: 'old', createdAt: '2020-01-01T00:00:00.000Z' }),
    ]);

    const res = await GET(
      makeRequest(`ownerAddress=${OWNER}&dateRange=all&columns=Commitment ID`),
      { params: {} },
    );
    const csv = await readCsvBody(res);

    expect(csv).toContain('recent');
    expect(csv).toContain('old');
  });

  it('excludes commitments with a missing createdAt when a narrower range is requested', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([
      commitment({ id: 'undated', createdAt: undefined }),
    ]);

    const res = await GET(
      makeRequest(`ownerAddress=${OWNER}&dateRange=30d&columns=Commitment ID`),
      { params: {} },
    );
    const csv = await readCsvBody(res);

    expect(csv).not.toContain('undated');
  });

  it('falls back to "all" for an unrecognized dateRange value instead of rejecting the request', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([
      commitment({ id: 'commitment-x', createdAt: '2020-01-01T00:00:00.000Z' }),
    ]);

    const res = await GET(
      makeRequest(`ownerAddress=${OWNER}&dateRange=not-a-real-range&columns=Commitment ID`),
      { params: {} },
    );
    const csv = await readCsvBody(res);

    expect(res.status).toBe(200);
    expect(csv).toContain('commitment-x');
  });
});
