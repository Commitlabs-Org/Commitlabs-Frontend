// tests/api/commitment-detail.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';
import { NotFoundError } from '@/lib/backend/errors';

// Mock the contracts service
vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
}));

const mockedGetCommitment = vi.mocked(require('@/lib/backend/services/contracts').getCommitmentFromChain);

function makeRequest(id: string) {
  return createMockRequest(`http://localhost:3000/api/commitments/${id}`);
}

describe('GET /api/commitments/[id]', () => {
  beforeEach(() => {
    vi.resetModules();
    mockedGetCommitment.mockReset();
  });

  it('returns 200 with CommitmentDto for a known id', async () => {
    const fakeCommitment = {
      id: 'CMT-123',
      ownerAddress: 'GOWNER',
      rules: { maxLossPercent: 20 },
      amount: BigInt('50000'),
      asset: 'XLM',
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-06-01T00:00:00.000Z',
      currentValue: BigInt('52000'),
      status: 'ACTIVE',
      drawdownPercent: 5,
      tokenId: 'TOKEN-1',
      contractVersion: 'v1',
    } as any;
    mockedGetCommitment.mockResolvedValue(fakeCommitment);

    const { GET } = await import('@/app/api/commitments/[id]/route');
    const res = await GET(makeRequest('CMT-123'), { params: { id: 'CMT-123' } });
    const result = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(result.data.success).toBe(true);
    const dto = result.data.data;
    expect(dto).toMatchObject({
      commitmentId: 'CMT-123',
      owner: 'GOWNER',
      amount: '50000',
      asset: 'XLM',
      status: 'ACTIVE',
      drawdownPercent: 5,
      tokenId: 'TOKEN-1',
      contractVersion: 'v1',
    });
    expect(typeof dto.amount).toBe('string');
    expect(typeof dto.currentValue).toBe('string');
    expect(dto.rules).toEqual({ maxLossPercent: 20 });
  });

  it('returns 404 when commitment does not exist', async () => {
    mockedGetCommitment.mockRejectedValue(new NotFoundError('Commitment', { commitmentId: 'missing' }));
    const { GET } = await import('@/app/api/commitments/[id]/route');
    const res = await GET(makeRequest('missing'), { params: { id: 'missing' } });
    const result = await parseResponse(res);
    expect(res.status).toBe(404);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for malformed/empty id', async () => {
    mockedGetCommitment.mockRejectedValue(new NotFoundError('Commitment', { commitmentId: '' }));
    const { GET } = await import('@/app/api/commitments/[id]/route');
    const res = await GET(makeRequest(''), { params: { id: '' } });
    const result = await parseResponse(res);
    expect(res.status).toBe(404);
  });
});
