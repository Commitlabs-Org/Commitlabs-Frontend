import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/notifications/route';
import { createMockRequest, parseResponse } from './helpers';
import * as mockDb from '@/lib/backend/mockDb';

vi.mock('@/lib/backend/mockDb', () => ({
  getMockData: vi.fn(),
}));

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockDb.getMockData as any).mockResolvedValue({
      commitments: [
        {
          id: 'CMT-1',
          ownerAddress: '0x123',
          asset: 'XLM',
          status: 'Active',
          daysRemaining: 5,
        },
        {
          id: 'CMT-2',
          ownerAddress: '0x123',
          asset: 'USDC',
          status: 'Violated',
          daysRemaining: 20,
        },
        {
          id: 'CMT-3',
          ownerAddress: '0x456', // Different owner
          asset: 'BTC',
          status: 'Active',
          daysRemaining: 3,
        },
      ],
      attestations: [
        {
          id: 'ATTR-1',
          commitmentId: 'CMT-1',
          severity: 'warning',
          observedAt: '2026-01-10T12:00:00Z',
        },
        {
          id: 'ATTR-2',
          commitmentId: 'CMT-2',
          verdict: 'fail',
          observedAt: '2026-01-11T12:00:00Z',
        },
      ],
      listings: [],
    });
  });

  it('should return 400 if ownerAddress is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/notifications');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.message).toContain('Missing ownerAddress');
  });

  it('should return notifications filtered by ownerAddress', async () => {
    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data).toHaveProperty('items');
    expect(result.data.data).toHaveProperty('total');
    
    // CMT-1 is nearing expiry (1), CMT-2 is violated (1)
    // CMT-1 has warning attestation (1), CMT-2 has failed attestation (1)
    // Total should be 4
    expect(result.data.data.total).toBe(4);
    expect(result.data.data.items.length).toBe(4);

    result.data.data.items.forEach((notification: any) => {
      expect(notification.ownerAddress).toBe('0x123');
      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('title');
      expect(notification).toHaveProperty('severity');
    });
  });

  it('should return empty list if owner has no commitments', async () => {
    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x999');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.total).toBe(0);
    expect(result.data.data.items.length).toBe(0);
  });

  it('should support pagination', async () => {
    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123&page=1&pageSize=2');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.page).toBe(1);
    expect(result.data.data.pageSize).toBe(2);
    expect(result.data.data.items.length).toBe(2);
    expect(result.data.data.total).toBe(4);
  });

  it('should return 400 for invalid pagination params', async () => {
    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123&page=0');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
  });
});
