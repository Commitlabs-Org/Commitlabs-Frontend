import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/commitments/route';
import { createMockRequest, parseResponse } from './helpers';
import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';

// Mock the contracts service
vi.mock('@/lib/backend/services/contracts', () => ({
    getUserCommitmentsFromChain: vi.fn(),
    createCommitmentOnChain: vi.fn(),
}));

describe('GET /api/commitments - Filters and Validation', () => {
    const mockAddress = 'GBRPYH6QC6WGLS33ADC6ZZZ2ZXZXZXZXZXZXZXZXZXZXZXZXZXZX';
    const mockCommitments = [
        {
            id: '1',
            ownerAddress: mockAddress,
            asset: 'XLM',
            amount: '1000',
            status: 'ACTIVE',
            complianceScore: 95,
            currentValue: '1000',
            feeEarned: '10',
            violationCount: 0,
            createdAt: '2026-01-01T00:00:00Z',
        },
        {
            id: '2',
            ownerAddress: mockAddress,
            asset: 'USDC',
            amount: '500',
            status: 'SETTLED',
            complianceScore: 80,
            currentValue: '500',
            feeEarned: '5',
            violationCount: 1,
            createdAt: '2026-01-02T00:00:00Z',
        },
        {
            id: '3',
            ownerAddress: mockAddress,
            asset: 'XLM',
            amount: '2000',
            status: 'ACTIVE',
            complianceScore: 60,
            currentValue: '2000',
            feeEarned: '20',
            violationCount: 2,
            createdAt: '2026-01-03T00:00:00Z',
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (getUserCommitmentsFromChain as any).mockResolvedValue(mockCommitments);
    });

    it('should return all commitments for an owner with default pagination', async () => {
        const req = createMockRequest(`http://localhost/api/commitments?ownerAddress=${mockAddress}`);
        const response = await GET(req);
        const { status, data } = await parseResponse(response);

        expect(status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.items).toHaveLength(3);
        expect(data.data.total).toBe(3);
        expect(data.data.page).toBe(1);
        expect(data.data.pageSize).toBe(10);
    });

    it('should filter by status', async () => {
        const req = createMockRequest(`http://localhost/api/commitments?ownerAddress=${mockAddress}&status=SETTLED`);
        const response = await GET(req);
        const { data } = await parseResponse(response);

        expect(data.data.items).toHaveLength(1);
        expect(data.data.items[0].status).toBe('SETTLED');
        expect(data.data.total).toBe(1);
    });

    it('should filter by minCompliance', async () => {
        const req = createMockRequest(`http://localhost/api/commitments?ownerAddress=${mockAddress}&minCompliance=90`);
        const response = await GET(req);
        const { data } = await parseResponse(response);

        expect(data.data.items).toHaveLength(1);
        expect(data.data.items[0].complianceScore).toBe(95);
        expect(data.data.total).toBe(1);
    });

    it('should filter by type (Safe placeholder)', async () => {
        // Our current implementation maps everything to 'Safe'
        const req = createMockRequest(`http://localhost/api/commitments?ownerAddress=${mockAddress}&type=Safe`);
        const response = await GET(req);
        const { data } = await parseResponse(response);

        expect(data.data.items).toHaveLength(3);
        expect(data.data.items.every((c: any) => c.type === 'Safe')).toBe(true);
    });

    it('should return empty list if type mismatch', async () => {
        const req = createMockRequest(`http://localhost/api/commitments?ownerAddress=${mockAddress}&type=Aggressive`);
        const response = await GET(req);
        const { data } = await parseResponse(response);

        expect(data.data.items).toHaveLength(0);
        expect(data.data.total).toBe(0);
    });

    it('should support pagination (page and pageSize)', async () => {
        const req = createMockRequest(`http://localhost/api/commitments?ownerAddress=${mockAddress}&page=2&pageSize=1`);
        const response = await GET(req);
        const { data } = await parseResponse(response);

        expect(data.data.items).toHaveLength(1);
        expect(data.data.items[0].id).toBe('2');
        expect(data.data.page).toBe(2);
        expect(data.data.pageSize).toBe(1);
        expect(data.data.total).toBe(3);
    });

    it('should throw validation error for invalid query params', async () => {
        const req = createMockRequest(`http://localhost/api/commitments?ownerAddress=${mockAddress}&page=-1`);
        const response = await GET(req);
        const { status, data } = await parseResponse(response);

        expect(status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should throw validation error for invalid status', async () => {
        const req = createMockRequest(`http://localhost/api/commitments?ownerAddress=${mockAddress}&status=INVALID_STATUS`);
        const response = await GET(req);
        const { status } = await parseResponse(response);

        expect(status).toBe(400);
    });

    it('should return 400 if ownerAddress is missing', async () => {
        const req = createMockRequest(`http://localhost/api/commitments`);
        const response = await GET(req);
        const { status } = await parseResponse(response);

        expect(status).toBe(400);
    });
});
