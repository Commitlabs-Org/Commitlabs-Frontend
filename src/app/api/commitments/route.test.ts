import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { getUserCommitmentsFromChain, createCommitmentOnChain } from '@/lib/backend/services/contracts';

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
  createCommitmentOnChain: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

describe('/api/commitments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when ownerAddress is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/commitments');

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 for invalid pagination', async () => {
    const request = new NextRequest('http://localhost:3000/api/commitments?ownerAddress=owner&page=0&pageSize=200');

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });

  it('returns paginated commitments and converts bigint fields to strings', async () => {
    const mockCommitments = [
      {
        id: 1n,
        ownerAddress: 'GTESTOWNER',
        asset: 'USDC',
        amount: 100000n,
        status: 'Active',
        complianceScore: 92,
        currentValue: 110000n,
        feeEarned: 1000,
        violationCount: 0,
        createdAt: '2026-04-01T00:00:00.000Z',
        expiresAt: '2026-04-25T00:00:00.000Z',
      },
      {
        id: 2n,
        ownerAddress: 'GTESTOWNER',
        asset: 'USDC',
        amount: 200000n,
        status: 'Active',
        complianceScore: 90,
        currentValue: 210000n,
        feeEarned: 2000,
        violationCount: 1,
        createdAt: '2026-04-02T00:00:00.000Z',
        expiresAt: '2026-05-02T00:00:00.000Z',
      },
    ];

    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue(mockCommitments as any);

    const request = new NextRequest('http://localhost:3000/api/commitments?ownerAddress=GTESTOWNER&page=1&pageSize=1');
    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.page).toBe(1);
    expect(data.data.pageSize).toBe(1);
    expect(data.data.total).toBe(2);
    expect(data.data.items).toHaveLength(1);
    expect(data.data.items[0]).toMatchObject({
      commitmentId: '1',
      amount: '100000',
      currentValue: '110000',
    });
  });

  it('creates a commitment successfully', async () => {
    const responsePayload = { commitmentId: 'commitment_1' };
    vi.mocked(createCommitmentOnChain).mockResolvedValue(responsePayload);

    const request = new NextRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: JSON.stringify({
        ownerAddress: 'GTESTOWNER',
        asset: 'USDC',
        amount: '1000',
        durationDays: 30,
        maxLossBps: 100,
      }),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(responsePayload);
    expect(createCommitmentOnChain).toHaveBeenCalledWith({
      ownerAddress: 'GTESTOWNER',
      asset: 'USDC',
      amount: '1000',
      durationDays: 30,
      maxLossBps: 100,
      metadata: undefined,
    });
  });
});
