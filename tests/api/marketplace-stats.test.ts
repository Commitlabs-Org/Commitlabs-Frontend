import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';
import { GET } from '@/app/api/marketplace/stats/route';
import * as rateLimit from '@/lib/backend/rateLimit';

// Mock the logger to avoid polluting test output
vi.mock('@/lib/backend/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    logDebug: vi.fn(),
}));

// Mock rateLimit module
vi.mock('@/lib/backend/rateLimit', () => ({
    checkRateLimit: vi.fn(),
}));

describe('GET /api/marketplace/stats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default to allow
        vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(true);
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('returns 200 with aggregated marketplace stats', async () => {
        const req = createMockRequest('http://localhost/api/marketplace/stats');
        
        const response = await GET(req, { params: {} });
        const result = await parseResponse(response);

        expect(response.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.data).toHaveProperty('activeListings');
        expect(result.data.data).toHaveProperty('averageYield');
        expect(result.data.data).toHaveProperty('medianPrice');
        
        expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=30');
    });

    it('returns stats matching the expected mock data values', async () => {
        const req = createMockRequest('http://localhost/api/marketplace/stats');
        const response = await GET(req, { params: {} });
        const result = await parseResponse(response);

        const stats = result.data.data;
        expect(stats.activeListings).toBe(6);
        expect(stats.medianPrice).toBe(130000);
        expect(stats.averageYield).toBe(12.43);
        expect(stats.typeBreakdown.Safe).toBe(2);
    });

    it('should return 429 when rate limit is exceeded', async () => {
        vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(false);

        const req = createMockRequest('http://localhost/api/marketplace/stats');
        const response = await GET(req, { params: {} });
        const result = await parseResponse(response);

        expect(response.status).toBe(429);
        expect(result.data.success).toBe(false);
        expect(result.data.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
});
