import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockRequest,
  parseResponse,
  createMockRouteContext,
} from './helpers';

// Mock dependencies BEFORE importing the route
vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn(() => 60),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
}));

// NOW import the route and dependencies
import { GET as getHandler } from '@/app/api/commitments/[id]/settle/preview/route';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { BackendError } from '@/lib/backend/errors';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetCommitmentFromChain = vi.mocked(getCommitmentFromChain);

// Cast handler to correct signature
const GET = getHandler as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

const COMMITMENT_ID = 'cm_123456';

describe('GET /api/commitments/[id]/settle/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
  });

  it('returns 200 and eligible true for expired active commitment', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: 'GOWNER',
      asset: 'USDC',
      amount: '1000',
      status: 'ACTIVE',
      complianceScore: 100,
      currentValue: '1050',
      feeEarned: '50',
      violationCount: 0,
      expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour ago
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data).toEqual({
      eligible: true,
      reason: null,
      estimatedSettlement: '1050',
    });
  });

  it('returns 200 and eligible false for non-expired active commitment', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: 'GOWNER',
      asset: 'USDC',
      amount: '1000',
      status: 'ACTIVE',
      complianceScore: 100,
      currentValue: '1050',
      feeEarned: '50',
      violationCount: 0,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour in future
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data).toEqual({
      eligible: false,
      reason: 'Commitment has not matured yet and cannot be settled.',
      estimatedSettlement: '1050',
    });
  });

  it('returns 200 and eligible false for already settled commitment', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: 'GOWNER',
      asset: 'USDC',
      amount: '1000',
      status: 'SETTLED',
      complianceScore: 100,
      currentValue: '1050',
      feeEarned: '50',
      violationCount: 0,
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data).toEqual({
      eligible: false,
      reason: 'Commitment has already been settled.',
      estimatedSettlement: '1050',
    });
  });

  it('returns 200 and eligible false for violated commitment', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      status: 'VIOLATED',
      currentValue: '1000',
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data).toEqual({
      eligible: false,
      reason: 'Commitment has been violated and cannot be settled.',
      estimatedSettlement: '1000',
    });
  });

  it('returns 200 and eligible false for early exited commitment', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      status: 'EARLY_EXIT',
      currentValue: '1000',
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data).toEqual({
      eligible: false,
      reason: 'Commitment has already been exited early.',
      estimatedSettlement: '1000',
    });
  });

  it('returns 200 and eligible false for created commitment', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      status: 'CREATED',
      currentValue: '1000',
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data).toEqual({
      eligible: false,
      reason: 'Commitment must be active to be settled.',
      estimatedSettlement: '1000',
    });
  });

  it('returns 200 and eligible false for disputed commitment', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      status: 'DISPUTED',
      currentValue: '1000',
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data).toEqual({
      eligible: false,
      reason: 'Commitment is currently in dispute and cannot be settled.',
      estimatedSettlement: '1000',
    });
  });

  it('returns 404 if commitment is missing or not found', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue(null as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(404);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 if getCommitmentFromChain throws a 404 BackendError', async () => {
    mockedGetCommitmentFromChain.mockRejectedValue(
      new BackendError({
        code: 'NOT_FOUND',
        message: 'Commitment not found',
        status: 404,
      }),
    );

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(404);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  it('returns 429 when rate limited', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(429);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('returns 404 if commitment ID is empty', async () => {
    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/ /settle/preview`),
      createMockRouteContext({ id: ' ' }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(404);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  it('returns 500 if getCommitmentFromChain throws a generic Error', async () => {
    mockedGetCommitmentFromChain.mockRejectedValue(new Error('Generic database failure'));

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(500);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns eligible false for commitment with unknown status', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      status: 'UNKNOWN_STATUS_ABC',
      currentValue: '1000',
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data).toEqual({
      eligible: false,
      reason: 'Commitment is in an ineligible state for settlement.',
      estimatedSettlement: '1000',
    });
  });

  it('returns eligible true for active commitment without expiresAt', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      status: 'ACTIVE',
      currentValue: '1000',
      expiresAt: undefined,
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data).toEqual({
      eligible: true,
      reason: null,
      estimatedSettlement: '1000',
    });
  });
});
