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

import { GET } from '@/app/api/commitments/export/route';
import { verifySessionToken } from '@/lib/backend/auth';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';

const mockedVerifySessionToken = vi.mocked(verifySessionToken);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetUserCommitmentsFromChain = vi.mocked(getUserCommitmentsFromChain);

const ownerAddress = 'GABC123OWNERADDRESS';

function createAuthorizedRequest(requestOwnerAddress = ownerAddress, token = 'valid-token') {
  return createMockRequest(
    `http://localhost:3000/api/commitments/export?ownerAddress=${encodeURIComponent(requestOwnerAddress)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}

describe('GET /api/commitments/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedVerifySessionToken.mockReturnValue({ valid: true, address: ownerAddress });
    mockedGetUserCommitmentsFromChain.mockResolvedValue([]);
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/export?ownerAddress=${ownerAddress}`)
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(401);
    expect(result.data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the session token is invalid', async () => {
    mockedVerifySessionToken.mockReturnValue({ valid: false });

    const response = await GET(createAuthorizedRequest());
    const result = await parseResponse(response);

    expect(mockedVerifySessionToken).toHaveBeenCalledWith('valid-token');
    expect(result.status).toBe(401);
    expect(result.data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when ownerAddress query param is missing', async () => {
    const response = await GET(
      createMockRequest('http://localhost:3000/api/commitments/export', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('BAD_REQUEST');
  });

  it("returns 403 when the authenticated address doesn't match the requested ownerAddress", async () => {
    const response = await GET(createAuthorizedRequest('GDIFFERENTOWNERADDRESS'));
    const result = await parseResponse(response);

    expect(result.status).toBe(403);
    expect(result.data.error.code).toBe('FORBIDDEN');
  });

  it('returns 200 with CSV download headers on success', async () => {
    const response = await GET(createAuthorizedRequest());
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(result.headers.get('content-disposition')).toBe('attachment; filename="commitments.csv"');
  });

  it('returns valid CSV with the correct headers', async () => {
    const response = await GET(createAuthorizedRequest());
    const result = await parseResponse(response);

    expect(result.data).toBe(
      'Commitment ID,Owner,Asset,Amount,Status,Compliance Score,Current Value,Fee Earned,Violation Count,Created At,Expires At\r\n'
    );
  });

  it('returns CSV rows with commitment data', async () => {
    const commitments: ChainCommitment[] = [
      {
        id: 'commitment-1',
        ownerAddress,
        asset: 'USDC',
        amount: '1000',
        status: 'ACTIVE',
        complianceScore: 91,
        currentValue: '1025',
        feeEarned: '10',
        violationCount: 0,
        createdAt: '2026-04-01T00:00:00.000Z',
        expiresAt: '2026-05-01T00:00:00.000Z',
      },
    ];
    mockedGetUserCommitmentsFromChain.mockResolvedValue(commitments);

    const response = await GET(createAuthorizedRequest());
    const result = await parseResponse(response);

    expect(mockedGetUserCommitmentsFromChain).toHaveBeenCalledWith(ownerAddress);
    expect(result.data).toBe(
      'Commitment ID,Owner,Asset,Amount,Status,Compliance Score,Current Value,Fee Earned,Violation Count,Created At,Expires At\r\n' +
        `commitment-1,${ownerAddress},USDC,1000,ACTIVE,91,1025,10,0,2026-04-01T00:00:00.000Z,2026-05-01T00:00:00.000Z\r\n`
    );
  });

  it('returns only headers when the user has no commitments', async () => {
    mockedGetUserCommitmentsFromChain.mockResolvedValue([]);

    const response = await GET(createAuthorizedRequest());
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data).toBe(
      'Commitment ID,Owner,Asset,Amount,Status,Compliance Score,Current Value,Fee Earned,Violation Count,Created At,Expires At\r\n'
    );
  });

  it('escapes special characters in commitment fields end-to-end', async () => {
    const commitments: ChainCommitment[] = [
      {
        id: 'commitment-1',
        ownerAddress,
        asset: '"Yield", Fund\nSeries A',
        amount: '1000',
        status: 'ACTIVE',
        complianceScore: 88,
        currentValue: '1005',
        feeEarned: '5',
        violationCount: 1,
        createdAt: ' 2026-04-01T00:00:00.000Z ',
        expiresAt: undefined,
      },
    ];
    mockedGetUserCommitmentsFromChain.mockResolvedValue(commitments);

    const response = await GET(createAuthorizedRequest());
    const result = await parseResponse(response);

    expect(result.data).toBe(
      'Commitment ID,Owner,Asset,Amount,Status,Compliance Score,Current Value,Fee Earned,Violation Count,Created At,Expires At\r\n' +
        `commitment-1,${ownerAddress},"""Yield"", Fund\nSeries A",1000,ACTIVE,88,1005,5,1," 2026-04-01T00:00:00.000Z ",\r\n`
    );
  });

  it('returns 429 when rate limiting blocks the request', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const response = await GET(createAuthorizedRequest());
    const result = await parseResponse(response);

    expect(mockedCheckRateLimit).toHaveBeenCalledWith('anonymous', 'api/commitments/export');
    expect(result.status).toBe(429);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
