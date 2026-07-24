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

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
  settleCommitmentOnChain: vi.fn(),
}));

vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));

vi.mock('@/lib/backend/logger', () => ({
  logCommitmentSettled: vi.fn(),
}));

// NOW import the route and dependencies
import { POST as settleHandler } from '@/app/api/commitments/[id]/settle/route';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getCommitmentFromChain, settleCommitmentOnChain } from '@/lib/backend/services/contracts';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetCommitmentFromChain = vi.mocked(getCommitmentFromChain);
const mockedSettleCommitmentOnChain = vi.mocked(settleCommitmentOnChain);

const COMMITMENT_ID = 'cm_123456';
const OWNER_ADDRESS = 'GOWNER';
const CALLER_ADDRESS = 'GOWNER';

// Cast handler to correct signature
const POST = settleHandler as (
  req: NextRequest,
  context: { params: Record<string, string> },
  correlationId: string,
) => Promise<Response>;

describe('POST /api/commitments/[id]/settle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
  });

  it('successfully settles a matured commitment by the owner', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'ACTIVE', // Assuming ACTIVE and expired means matured
      expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    } as any);

    mockedSettleCommitmentOnChain.mockResolvedValue({
      settlementAmount: '1050',
      finalStatus: 'SETTLED',
      txHash: 'tx-settle-123',
      reference: 'ref-settle-123',
    } as any);

    const req = createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: { callerAddress: CALLER_ADDRESS },
    });
    const response = await POST(req, createMockRouteContext({ id: COMMITMENT_ID }), 'corr-123');
    const result = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data).toMatchObject({
      commitmentId: COMMITMENT_ID,
      settlementAmount: '1050',
      finalStatus: 'SETTLED',
      txHash: 'tx-settle-123',
    });
    expect(mockedSettleCommitmentOnChain).toHaveBeenCalledWith(
      {
        commitmentId: COMMITMENT_ID,
        callerAddress: CALLER_ADDRESS,
      },
      { requestId: 'corr-123' },
    );
  });

  it('rejects settlement if the caller is not the owner', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    } as any);

    const req = createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: { callerAddress: 'GBADADDR' },
    });
    const response = await POST(req, createMockRouteContext({ id: COMMITMENT_ID }), 'corr-123');
    const result = await parseResponse(response);

    expect(response.status).toBe(403);
    expect(result.data.error.code).toBe('FORBIDDEN');
    expect(result.data.error.message).toContain('owner');
  });

  it('rejects settlement if the commitment is not matured (still active)', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // in future
    } as any);

    // settleCommitmentOnChain throws NOT_MATURED error if not matured.
    // We need to import ConflictError or whatever error is thrown.
    // Actually, let's use a generic error first and see what happens, or just mock it.
    // Since I know it's NOT_MATURED from the implementation of settleCommitmentOnChain.
    
    // To mock a rejection with a specific error, we can do:
    // vi.mocked(settleCommitmentOnChain).mockRejectedValue(new BackendError({ code: 'NOT_MATURED', ... }));
    // But I need to import BackendError.

    // Wait, I can also just use the error that is thrown.
    // Let's import it.
    
    const { BackendError } = await import('@/lib/backend/errors');
    vi.mocked(settleCommitmentOnChain).mockRejectedValue(new BackendError({
      code: 'NOT_MATURED',
      message: 'Commitment has not matured yet and cannot be settled.',
      status: 400,
    }));

    const req = createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: { callerAddress: CALLER_ADDRESS },
    });
    const response = await POST(req, createMockRouteContext({ id: COMMITMENT_ID }), 'corr-123');
    const result = await parseResponse(response);

    expect(response.status).toBe(400);
    expect(result.data.error.code).toBe('NOT_MATURED');
    expect(result.data.error.message).toContain('not matured yet');
  });

  it('rejects settlement if the commitment is missing maturity information', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'ACTIVE',
      expiresAt: undefined,
    } as any);

    const { BackendError } = await import('@/lib/backend/errors');
    vi.mocked(settleCommitmentOnChain).mockRejectedValue(new BackendError({
      code: 'NOT_MATURED',
      message: 'Commitment maturity information is missing. Cannot settle.',
      status: 400,
    }));

    const req = createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: { callerAddress: CALLER_ADDRESS },
    });
    const response = await POST(req, createMockRouteContext({ id: COMMITMENT_ID }), 'corr-123');
    const result = await parseResponse(response);

    expect(response.status).toBe(400);
    expect(result.data.error.code).toBe('NOT_MATURED');
    expect(result.data.error.message).toContain('maturity information is missing');
  });

  it('rejects settlement if the commitment is already settled', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'SETTLED',
    } as any);

    const req = createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: { callerAddress: CALLER_ADDRESS },
    });
    const response = await POST(req, createMockRouteContext({ id: COMMITMENT_ID }), 'corr-123');
    const result = await parseResponse(response);

    expect(response.status).toBe(409);
    expect(result.data.error.code).toBe('CONFLICT');
    expect(result.data.error.message).toContain('already been settled');
  });

  it('rejects settlement if the commitment has been violated', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'VIOLATED',
    } as any);

    const req = createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: { callerAddress: CALLER_ADDRESS },
    });
    const response = await POST(req, createMockRouteContext({ id: COMMITMENT_ID }), 'corr-123');
    const result = await parseResponse(response);

    expect(response.status).toBe(409);
    expect(result.data.error.code).toBe('CONFLICT');
    expect(result.data.error.message).toContain('violated');
  });

  it('rejects settlement if the commitment has already been exited early', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue({
      id: COMMITMENT_ID,
      ownerAddress: OWNER_ADDRESS,
      status: 'EARLY_EXIT',
    } as any);

    const req = createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: { callerAddress: CALLER_ADDRESS },
    });
    const response = await POST(req, createMockRouteContext({ id: COMMITMENT_ID }), 'corr-123');
    const result = await parseResponse(response);

    expect(response.status).toBe(409);
    expect(result.data.error.code).toBe('CONFLICT');
    expect(result.data.error.message).toContain('exited early');
  });

  it('returns 404 if commitment is not found', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue(null);

    const req = createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: { callerAddress: CALLER_ADDRESS },
    });
    const response = await POST(req, createMockRouteContext({ id: COMMITMENT_ID }), 'corr-123');
    const result = await parseResponse(response);

    expect(response.status).toBe(404);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 if request body is invalid JSON', async () => {
    const req = createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: 'invalid json',
    });
    // Note: createMockRequest might not allow passing invalid JSON directly as a string if it's supposed to be an object.
    // But it uses JSON.stringify(body). If body is a string, it will be "invalid json" (quoted).
    // To send truly invalid JSON, we need to bypass JSON.stringify.

    // Let's try to manually create the request for this case.
    const manualReq = new NextRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(manualReq, createMockRouteContext({ id: COMMITMENT_ID }), 'corr-123');
    const result = await parseResponse(response);

    expect(response.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
    expect(result.data.error.message).toContain('Invalid JSON');
  });

  it('returns 400 if request body fails schema validation', async () => {
    const req = createMockRequest(`http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`, {
      method: 'POST',
      body: { wrongField: 'value' },
    });
    const response = await POST(req, createMockRouteContext({ id: COMMITMENT_ID }), 'corr-123');
    const result = await parseResponse(response);

    expect(response.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
    expect(result.data.error.message).toContain('Invalid request data');
  });
});
