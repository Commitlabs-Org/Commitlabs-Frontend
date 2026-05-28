import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn().mockReturnValue(60),
}));

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
  fundEscrowOnChain: vi.fn(),
}));

vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);

function postRequest(url: string, body?: unknown) {
  return createMockRequest(url, { method: 'POST', body });
}

describe('POST /api/commitments/[id]/fund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
  });

  it('rejects funding when commitment status is not CREATED', async () => {
    const { getCommitmentFromChain } = await import('@/lib/backend/services/contracts');
    vi.mocked(getCommitmentFromChain).mockResolvedValue({
      id: 'c-1',
      ownerAddress: 'GOWNER',
      status: 'ACTIVE',
    } as any);

    const { POST } = await import('@/app/api/commitments/[id]/fund/route');
    const req = postRequest('http://localhost:3000/api/commitments/c-1/fund', {
      callerAddress: 'GOWNER',
    });
    const response = await POST(req, createMockRouteContext({ id: 'c-1' }));
    const result = await parseResponse(response);

    expect(response.status).toBe(409);
    expect(result.data.error.code).toBe('CONFLICT');
    expect(result.data.error.message).toContain('created');
  });

  it('rejects funding when the caller address does not own the commitment', async () => {
    const { getCommitmentFromChain } = await import('@/lib/backend/services/contracts');
    vi.mocked(getCommitmentFromChain).mockResolvedValue({
      id: 'c-2',
      ownerAddress: 'GOWNER',
      status: 'CREATED',
    } as any);

    const { POST } = await import('@/app/api/commitments/[id]/fund/route');
    const req = postRequest('http://localhost:3000/api/commitments/c-2/fund', {
      callerAddress: 'GBADADDR',
    });
    const response = await POST(req, createMockRouteContext({ id: 'c-2' }));
    const result = await parseResponse(response);

    expect(response.status).toBe(403);
    expect(result.data.error.code).toBe('FORBIDDEN');
    expect(result.data.error.message).toContain('owner');
  });

  it('funds a created commitment when the owner submits the request', async () => {
    const { getCommitmentFromChain, fundEscrowOnChain } = await import('@/lib/backend/services/contracts');
    vi.mocked(getCommitmentFromChain).mockResolvedValue({
      id: 'c-3',
      ownerAddress: 'GOWNER',
      status: 'CREATED',
    } as any);
    vi.mocked(fundEscrowOnChain).mockResolvedValue({
      commitmentId: 'c-3',
      txHash: 'tx-123',
      reference: 'funded',
    } as any);

    const { POST } = await import('@/app/api/commitments/[id]/fund/route');
    const req = postRequest('http://localhost:3000/api/commitments/c-3/fund', {
      callerAddress: 'GOWNER',
    });
    const response = await POST(req, createMockRouteContext({ id: 'c-3' }));
    const result = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.commitmentId).toBe('c-3');
    expect(result.data.data.txHash).toBe('tx-123');
    expect(vi.mocked(fundEscrowOnChain)).toHaveBeenCalledWith({
      commitmentId: 'c-3',
      callerAddress: 'GOWNER',
    });
  });
});
