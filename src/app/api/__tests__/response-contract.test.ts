import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the dependencies to test contract compliance
vi.mock('@/lib/backend/rateLimit', () => ({
    checkRateLimit: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/lib/backend/auth', () => ({
    generateNonce: vi.fn(() => 'test-nonce-123'),
    storeNonce: vi.fn(() => ({ expiresAt: new Date() })),
    generateChallengeMessage: vi.fn(() => 'Sign in to CommitLabs: test-nonce-123'),
    verifySignatureWithNonce: vi.fn(() => ({ valid: true, address: 'GTEST123456789' })),
    createSessionToken: vi.fn(() => ({ token: 'jwt-token', csrfToken: 'csrf-token' })),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
    getUserCommitmentsFromChain: vi.fn(() => []),
    createCommitmentOnChain: vi.fn(() => ({ commitmentId: '123' })),
    getCommitmentFromChain: vi.fn(() => ({
        commitmentId: '123',
        owner: 'GTEST123456789',
        rules: {},
        amount: '1000',
        asset: 'USDC',
        createdAt: '2023-01-01T00:00:00Z',
        expiresAt: '2024-01-01T00:00:00Z',
        currentValue: '1000',
        status: 'active',
    })),
}));

vi.mock('@/lib/backend/mockDb', () => ({
    getMockData: vi.fn(() => ({ attestations: [] })),
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
    marketplaceService: {
        createListing: vi.fn(() => ({ listingId: '123' })),
        cancelListing: vi.fn(() => ({})),
    },
    listMarketplaceListings: vi.fn(() => []),
}));

describe('API Response Contract Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Auth routes', () => {
        it('should follow contract for POST /api/auth/nonce', async () => {
            const { POST } = await import('../auth/nonce/route');
            
            const req = new NextRequest('http://localhost:3000/api/auth/nonce', {
                method: 'POST',
                body: JSON.stringify({ address: 'GTEST123456789' }),
                headers: {
                    'content-type': 'application/json',
                    'x-correlation-id': 'auth-nonce-test',
                },
            });

            const response = await POST(req, { params: {} }, 'auth-nonce-test');

            expect(response.status).toBe(200);
            expect(response.headers.get('x-correlation-id')).toBe('auth-nonce-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: true,
                data: {
                    nonce: 'test-nonce-123',
                    message: 'Sign in to CommitLabs: test-nonce-123',
                    expiresAt: expect.any(String),
                },
                meta: {
                    correlationId: 'auth-nonce-test',
                    timestamp: expect.any(String),
                },
            });
        });

        it('should follow contract for POST /api/auth/verify', async () => {
            const { POST } = await import('../auth/verify/route');
            
            const req = new NextRequest('http://localhost:3000/api/auth/verify', {
                method: 'POST',
                body: JSON.stringify({
                    address: 'GTEST123456789',
                    signature: 'test-signature',
                    message: 'Sign in to CommitLabs: test-nonce-123',
                }),
                headers: {
                    'content-type': 'application/json',
                    'x-correlation-id': 'auth-verify-test',
                },
            });

            const response = await POST(req, { params: {} }, 'auth-verify-test');

            expect(response.status).toBe(200);
            expect(response.headers.get('x-correlation-id')).toBe('auth-verify-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: true,
                data: {
                    verified: true,
                    address: 'GTEST123456789',
                    message: 'Signature verified successfully',
                    csrfToken: 'csrf-token',
                },
                meta: {
                    correlationId: 'auth-verify-test',
                    timestamp: expect.any(String),
                },
            });
        });
    });

    describe('Commitments routes', () => {
        it('should follow contract for GET /api/commitments', async () => {
            const { GET } = await import('../commitments/route');
            
            const req = new NextRequest('http://localhost:3000/api/commitments?ownerAddress=GTEST123456789', {
                headers: {
                    'x-correlation-id': 'commitments-get-test',
                },
            });

            const response = await GET(req, { params: {} }, 'commitments-get-test');

            expect(response.status).toBe(200);
            expect(response.headers.get('x-correlation-id')).toBe('commitments-get-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: true,
                data: {
                    items: [],
                    page: 1,
                    pageSize: 10,
                    total: 0,
                },
                meta: {
                    correlationId: 'commitments-get-test',
                    timestamp: expect.any(String),
                },
            });
        });

        it('should follow contract for POST /api/commitments', async () => {
            const { POST } = await import('../commitments/route');
            
            const req = new NextRequest('http://localhost:3000/api/commitments', {
                method: 'POST',
                body: JSON.stringify({
                    ownerAddress: 'GTEST123456789',
                    asset: 'USDC',
                    amount: '1000',
                    durationDays: 365,
                    maxLossBps: 1000,
                }),
                headers: {
                    'content-type': 'application/json',
                    'x-correlation-id': 'commitments-post-test',
                },
            });

            const response = await POST(req, { params: {} }, 'commitments-post-test');

            expect(response.status).toBe(201);
            expect(response.headers.get('x-correlation-id')).toBe('commitments-post-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: true,
                data: { commitmentId: '123' },
                meta: {
                    correlationId: 'commitments-post-test',
                    timestamp: expect.any(String),
                },
            });
        });

        it('should follow contract for GET /api/commitments/[id]', async () => {
            const { GET } = await import('../commitments/[id]/route');
            
            const req = new NextRequest('http://localhost:3000/api/commitments/123', {
                headers: {
                    'x-correlation-id': 'commitments-id-test',
                },
            });

            const response = await GET(req, { params: { id: '123' } }, 'commitments-id-test');

            expect(response.status).toBe(200);
            expect(response.headers.get('x-correlation-id')).toBe('commitments-id-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: true,
                data: {
                    commitmentId: '123',
                    owner: 'GTEST123456789',
                    asset: 'USDC',
                    status: 'active',
                    daysRemaining: expect.any(Number),
                },
                meta: {
                    correlationId: 'commitments-id-test',
                    timestamp: expect.any(String),
                },
            });
        });
    });

    describe('Attestations routes', () => {
        it('should follow contract for GET /api/attestations', async () => {
            const { GET } = await import('../attestations/route');
            
            const req = new NextRequest('http://localhost:3000/api/attestations', {
                headers: {
                    'x-correlation-id': 'attestations-get-test',
                },
            });

            const response = await GET(req, { params: {} }, 'attestations-get-test');

            expect(response.status).toBe(200);
            expect(response.headers.get('x-correlation-id')).toBe('attestations-get-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: true,
                data: { attestations: [] },
                meta: {
                    correlationId: 'attestations-get-test',
                    timestamp: expect.any(String),
                },
            });
        });
    });

    describe('Marketplace routes', () => {
        it('should follow contract for GET /api/marketplace/listings', async () => {
            const { GET } = await import('../marketplace/listings/route');
            
            const req = new NextRequest('http://localhost:3000/api/marketplace/listings', {
                headers: {
                    'x-correlation-id': 'marketplace-get-test',
                },
            });

            const response = await GET(req, { params: {} }, 'marketplace-get-test');

            expect(response.status).toBe(200);
            expect(response.headers.get('x-correlation-id')).toBe('marketplace-get-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: true,
                data: {
                    listings: [],
                    cards: [],
                    total: 0,
                },
                meta: {
                    correlationId: 'marketplace-get-test',
                    timestamp: expect.any(String),
                },
            });
        });

        it('should follow contract for POST /api/marketplace/listings', async () => {
            const { POST } = await import('../marketplace/listings/route');
            
            const req = new NextRequest('http://localhost:3000/api/marketplace/listings', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'Safe',
                    minCompliance: 80,
                    maxLoss: 1000,
                    amount: '1000',
                }),
                headers: {
                    'content-type': 'application/json',
                    'x-correlation-id': 'marketplace-post-test',
                },
            });

            const response = await POST(req, { params: {} }, 'marketplace-post-test');

            expect(response.status).toBe(201);
            expect(response.headers.get('x-correlation-id')).toBe('marketplace-post-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: true,
                data: {
                    listing: { listingId: '123' },
                },
                meta: {
                    correlationId: 'marketplace-post-test',
                    timestamp: expect.any(String),
                },
            });
        });
    });

    describe('Utility routes', () => {
        it('should follow contract for GET /api/metrics', async () => {
            const { GET } = await import('../metrics/route');
            
            const req = new NextRequest('http://localhost:3000/api/metrics', {
                headers: {
                    'x-correlation-id': 'metrics-test',
                },
            });

            const response = await GET(req, { params: {} }, 'metrics-test');

            expect(response.status).toBe(200);
            expect(response.headers.get('x-correlation-id')).toBe('metrics-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: true,
                data: {
                    status: 'up',
                    uptime: expect.any(Number),
                    mock_requests_total: expect.any(Number),
                    mock_errors_total: expect.any(Number),
                    timestamp: expect.any(String),
                },
                meta: {
                    correlationId: 'metrics-test',
                    timestamp: expect.any(String),
                },
            });
        });
    });

    describe('Error contract compliance', () => {
        it('should follow error contract for validation errors', async () => {
            const { POST } = await import('../auth/nonce/route');
            
            const req = new NextRequest('http://localhost:3000/api/auth/nonce', {
                method: 'POST',
                body: JSON.stringify({}), // Missing address
                headers: {
                    'content-type': 'application/json',
                    'x-correlation-id': 'error-contract-test',
                },
            });

            const response = await POST(req, { params: {} }, 'error-contract-test');

            expect(response.status).toBe(400);
            expect(response.headers.get('x-correlation-id')).toBe('error-contract-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: expect.any(String),
                    correlationId: 'error-contract-test',
                    timestamp: expect.any(String),
                },
            });
        });

        it('should follow error contract for missing required parameters', async () => {
            const { GET } = await import('../commitments/route');
            
            const req = new NextRequest('http://localhost:3000/api/commitments', {
                headers: {
                    'x-correlation-id': 'missing-param-test',
                },
            });

            const response = await GET(req, { params: {} }, 'missing-param-test');

            expect(response.status).toBe(400);
            expect(response.headers.get('x-correlation-id')).toBe('missing-param-test');

            const json = await response.json();
            expect(json).toMatchObject({
                success: false,
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Missing ownerAddress',
                    correlationId: 'missing-param-test',
                    timestamp: expect.any(String),
                },
            });
        });
    });

    describe('Header consistency', () => {
        it('should always include correlation ID header regardless of response type', async () => {
            const testCases = [
                { route: '../auth/nonce/route', method: 'POST', body: { address: 'GTEST123456789' } },
                { route: '../commitments/route', method: 'GET', body: null },
                { route: '../attestations/route', method: 'GET', body: null },
                { route: '../metrics/route', method: 'GET', body: null },
            ];

            for (const testCase of testCases) {
                const { GET, POST } = await import(testCase.route);
                const handler = testCase.method === 'GET' ? GET : POST;
                
                const correlationId = `header-test-${Math.random()}`;
                const req = new NextRequest(`http://localhost:3000/api/test`, {
                    method: testCase.method,
                    headers: {
                        'x-correlation-id': correlationId,
                        ...(testCase.body && { 'content-type': 'application/json' }),
                    },
                    ...(testCase.body && { body: JSON.stringify(testCase.body) }),
                });

                const response = await handler(req, { params: {} }, correlationId);

                expect(response.headers.get('x-correlation-id')).toBe(correlationId);
            }
        });
    });
});
