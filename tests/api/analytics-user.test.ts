// tests/api/analytics-user.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';
import { GET } from '@/app/api/analytics/user/route';

// Mock feature flag
vi.mock('@/lib/backend/config', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

// Mock contract service
vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
}));

const { getUserCommitmentsFromChain } = await import('@/lib/backend/services/contracts');
const { isFeatureEnabled } = await import('@/lib/backend/config');

describe('GET /api/analytics/user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFeatureEnabled.mockReturnValue(true);
  });

  it('returns 400 when ownerAddress missing', async () => {
    const req = createMockRequest('http://localhost/api/analytics/user', { method: 'GET' });
    const response = await GET(req);
    const result = await parseResponse(response);
    expect(response.status).toBe(400);
    expect(result.data.error.code).toBe('BAD_REQUEST');
  });

  it('returns 404 when feature flag disabled', async () => {
    isFeatureEnabled.mockReturnValue(false);
    const req = createMockRequest('http://localhost/api/analytics/user?ownerAddress=GOWNER', { method: 'GET' });
    const response = await GET(req);
    const result = await parseResponse(response);
    expect(response.status).toBe(404);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  it('returns zeroed analytics when no commitments', async () => {
    getUserCommitmentsFromChain.mockResolvedValue([]);
    const req = createMockRequest('http://localhost/api/analytics/user?ownerAddress=GOWNER', { method: 'GET' });
    const response = await GET(req);
    const result = await parseResponse(response);
    expect(response.status).toBe(200);
    const data = result.data;
    expect(data.ownerAddress).toBe('GOWNER');
    expect(data.totalCommitments).toBe(0);
    expect(data.activeCommitments).toBe(0);
    expect(data.totalValueCommitted).toBe('0.00');
    expect(data.feesEarned).toBe('0.00');
    expect(data.averageComplianceScore).toBe(0);
    expect(data.violationCount).toBe(0);
  });

  it('returns analytics shape with commitments', async () => {
    const mockCommitments = [
      {
        id: 'c1',
        ownerAddress: 'GOWNER',
        asset: 'USD',
        amount: '100',
        status: 'ACTIVE',
        complianceScore: 80,
        currentValue: '110',
        feeEarned: '5',
        violationCount: 1,
      },
      {
        id: 'c2',
        ownerAddress: 'GOWNER',
        asset: 'USD',
        amount: '200',
        status: 'CREATED',
        complianceScore: 90,
        currentValue: '210',
        feeEarned: '10',
        violationCount: 0,
      },
    ];
    getUserCommitmentsFromChain.mockResolvedValue(mockCommitments);
    const req = createMockRequest('http://localhost/api/analytics/user?ownerAddress=GOWNER', { method: 'GET' });
    const response = await GET(req);
    const result = await parseResponse(response);
    expect(response.status).toBe(200);
    const data = result.data;
    expect(data.ownerAddress).toBe('GOWNER');
    expect(data.totalCommitments).toBe(2);
    expect(data.activeCommitments).toBe(1);
    expect(data.totalValueCommitted).toBe('300.00');
    expect(data.feesEarned).toBe('15.00');
    // average compliance score = (80+90)/2 = 85
    expect(data.averageComplianceScore).toBe(85);
    expect(data.violationCount).toBe(1);
  });
});
