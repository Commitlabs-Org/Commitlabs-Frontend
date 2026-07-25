import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChainCommitment } from '@/lib/backend/services/contracts';
import { createMockRequest, parseResponse } from './helpers';

vi.mock('@/lib/backend/auth', () => ({
  verifySessionToken: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
}));

vi.mock('@/lib/backend/services/commitmentHistory', () => ({
  getCommitmentHistory: vi.fn(),
}));

import { GET } from '@/app/api/transactions/export/route';
import { verifySessionToken } from '@/lib/backend/auth';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';
import { getCommitmentHistory } from '@/lib/backend/services/commitmentHistory';

const mockedVerifySessionToken = vi.mocked(verifySessionToken);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetUserCommitmentsFromChain = vi.mocked(getUserCommitmentsFromChain);
const mockedGetCommitmentHistory = vi.mocked(getCommitmentHistory);

const ownerAddress = 'GABC123OWNERADDRESS';

function createAuthorizedRequest(queryStr = '', token = 'valid-token') {
  const url = `http://localhost:3000/api/transactions/export?ownerAddress=${encodeURIComponent(ownerAddress)}${queryStr ? `&${queryStr}` : ''}`;
  return createMockRequest(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

describe('GET /api/transactions/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedVerifySessionToken.mockReturnValue({ valid: true, address: ownerAddress });
    mockedGetUserCommitmentsFromChain.mockResolvedValue([]);
    mockedGetCommitmentHistory.mockResolvedValue({ events: [], total: 0 });
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const response = await GET(
      createMockRequest(`http://localhost:3000/api/transactions/export?ownerAddress=${ownerAddress}`)
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(401);
    expect(result.data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the session token is invalid', async () => {
    mockedVerifySessionToken.mockReturnValue({ valid: false });

    const response = await GET(createAuthorizedRequest());
    const result = await parseResponse(response);

    expect(result.status).toBe(401);
    expect(result.data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when ownerAddress query param is missing', async () => {
    const response = await GET(
      createMockRequest('http://localhost:3000/api/transactions/export', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('BAD_REQUEST');
  });

  it("returns 403 when authenticated address does not match requested ownerAddress", async () => {
    mockedVerifySessionToken.mockReturnValue({ valid: true, address: 'GOTHERADDRESS' });

    const response = await GET(createAuthorizedRequest());
    const result = await parseResponse(response);

    expect(result.status).toBe(403);
    expect(result.data.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when format parameter is invalid', async () => {
    const response = await GET(createAuthorizedRequest('format=pdf'));
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('BAD_REQUEST');
  });

  it('returns 200 with CSV headers and attachment disposition for CSV format export', async () => {
    const response = await GET(createAuthorizedRequest('format=csv'));
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(result.headers.get('content-disposition')).toBe('attachment; filename="transactions.csv"');
    expect(result.data).toContain('Transaction ID,Date,Type,Asset,Amount,Status,Tx Hash,Commitment ID\r\n');
  });

  it('returns 200 with JSON headers and attachment disposition for JSON format export', async () => {
    const response = await GET(createAuthorizedRequest('format=json'));
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(result.headers.get('content-disposition')).toBe('attachment; filename="transactions.json"');
    expect(JSON.parse(result.data)).toEqual([]);
  });

  it('filters data when filter query parameters are provided', async () => {
    const mockCommitment: ChainCommitment = {
      id: 'CMT-1',
      ownerAddress,
      asset: 'USDC',
      amount: '1000',
      status: 'ACTIVE',
      complianceScore: 90,
      currentValue: '1000',
      feeEarned: '0',
      violationCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    mockedGetUserCommitmentsFromChain.mockResolvedValue([mockCommitment]);
    mockedGetCommitmentHistory.mockResolvedValue({
      events: [
        {
          eventId: 'created:CMT-1',
          kind: 'created',
          occurredAt: '2026-01-01T00:00:00.000Z',
          payload: { asset: 'USDC', amount: '1000' },
        },
      ],
      total: 1,
    });

    const queryStr = 'format=json&asset=USDC&type=created&minAmount=500&maxAmount=1500';
    const response = await GET(createAuthorizedRequest(queryStr));
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    const data = JSON.parse(result.data);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('created:CMT-1');
    expect(data[0].asset).toBe('USDC');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const response = await GET(createAuthorizedRequest());
    const result = await parseResponse(response);

    expect(result.status).toBe(429);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
