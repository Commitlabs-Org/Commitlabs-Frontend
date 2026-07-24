import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockRequest,
  createMockRouteContext,
  parseResponse,
} from './helpers';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn(() => 60),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
}));

vi.mock('@/lib/backend/services/protocolConstants', () => ({
  getProtocolConstants: vi.fn(),
}));

import { GET as getHandler } from '@/app/api/commitments/[id]/early-exit/preview/route';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { getProtocolConstants } from '@/lib/backend/services/protocolConstants';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetCommitmentFromChain = vi.mocked(getCommitmentFromChain);
const mockedGetProtocolConstants = vi.mocked(getProtocolConstants);

const GET = getHandler as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

const COMMITMENT_ID = 'cm_123456';
const NOW = new Date('2026-06-27T12:00:00.000Z');

describe('GET /api/commitments/[id]/early-exit/preview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();

    mockedCheckRateLimit.mockResolvedValue(true);
    mockedGetProtocolConstants.mockReturnValue({
      penalties: [
        {
          type: 'safe',
          earlyExitPenaltyPercent: 2,
          description: 'Low-risk commitment',
        },
        {
          type: 'balanced',
          earlyExitPenaltyPercent: 3,
          description: 'Moderate-risk commitment',
        },
      ],
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns penalty and net refund for an active commitment', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      amount: '1000',
      status: 'ACTIVE',
      type: 'balanced',
      createdAt: '2026-06-17T12:00:00.000Z',
      expiresAt: '2026-07-07T12:00:00.000Z',
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data).toEqual({
      principal: 1000,
      penaltyPercent: 1.5,
      penaltyAmount: 15,
      netRefund: 985,
    });
  });

  it('returns a near-zero penalty at or near maturity', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      amount: '1000',
      status: 'ACTIVE',
      type: 'safe',
      createdAt: '2026-06-27T11:00:00.000Z',
      expiresAt: '2026-06-27T12:00:00.000Z',
    } as any);

    const maturedResponse = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const maturedResult = await parseResponse(maturedResponse);

    expect(maturedResult.status).toBe(200);
    expect(maturedResult.data.data).toEqual({
      principal: 1000,
      penaltyPercent: 0,
      penaltyAmount: 0,
      netRefund: 1000,
    });

    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      amount: '1000',
      status: 'ACTIVE',
      type: 'safe',
      createdAt: '2026-06-27T11:00:00.000Z',
      expiresAt: '2026-06-27T12:00:01.000Z',
    } as any);

    const nearMaturityResponse = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const nearMaturityResult = await parseResponse(nearMaturityResponse);

    expect(nearMaturityResult.status).toBe(200);
    expect(nearMaturityResult.data.data.penaltyPercent).toBeGreaterThan(0);
    expect(nearMaturityResult.data.data.penaltyPercent).toBeLessThan(0.001);
    expect(nearMaturityResult.data.data.penaltyAmount).toBe(0.01);
    expect(nearMaturityResult.data.data.netRefund).toBe(999.99);
  });

  it('returns 404 for an unknown commitment id', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue(null as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(404);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 for a settled commitment', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      amount: '1000',
      status: 'SETTLED',
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(409);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('CONFLICT');
  });

  it('returns 409 for a violated commitment', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      amount: '1000',
      status: 'VIOLATED',
    } as any);

    const response = await GET(
      createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/early-exit/preview`),
      createMockRouteContext({ id: COMMITMENT_ID }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(409);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('CONFLICT');
  });
});
