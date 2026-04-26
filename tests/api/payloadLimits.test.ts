import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { JSON_BODY_LIMITS } from '@/lib/backend/jsonBodyLimit';

// Avoid hitting the rate limiter during these tests — they're a pure
// payload-size concern.
vi.mock('@/lib/backend/rateLimit', () => ({
    checkRateLimit: vi.fn(async () => true),
}));

// Marketplace service is mocked because the marketplace route calls it on
// the happy path; we never exercise that here but the import graph demands it.
vi.mock('@/lib/backend/services/marketplace', async () => {
    const actual =
        await vi.importActual<typeof import('@/lib/backend/services/marketplace')>(
            '@/lib/backend/services/marketplace'
        );
    return {
        ...actual,
        marketplaceService: {
            createListing: vi.fn(),
        },
    };
});

function oversizedRequest(url: string, limit: number): NextRequest {
    const padding = 'a'.repeat(limit + 64);
    return new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ junk: padding }),
    });
}

describe('POST /api/auth/verify — payload size limit', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 413 PAYLOAD_TOO_LARGE for oversized bodies', async () => {
        const { POST } = await import('@/app/api/auth/verify/route');
        const req = oversizedRequest(
            'http://localhost/api/auth/verify',
            JSON_BODY_LIMITS.authVerify
        );

        const res = await POST(req, { params: {} });
        const body = await res.json();

        expect(res.status).toBe(413);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
});

describe('POST /api/commitments — payload size limit', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 413 PAYLOAD_TOO_LARGE for oversized bodies', async () => {
        const { POST } = await import('@/app/api/commitments/route');
        const req = oversizedRequest(
            'http://localhost/api/commitments',
            JSON_BODY_LIMITS.commitmentsCreate
        );

        const res = await POST(req, { params: {} });
        const body = await res.json();

        expect(res.status).toBe(413);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
});

describe('POST /api/attestations — payload size limit', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 413 PAYLOAD_TOO_LARGE for oversized bodies', async () => {
        const { POST } = await import('@/app/api/attestations/route');
        const req = oversizedRequest(
            'http://localhost/api/attestations',
            JSON_BODY_LIMITS.attestationsCreate
        );

        const res = await POST(req, { params: {} });
        const body = await res.json();

        expect(res.status).toBe(413);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
});

describe('POST /api/marketplace/listings — payload size limit', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 413 PAYLOAD_TOO_LARGE for oversized bodies', async () => {
        const { POST } = await import('@/app/api/marketplace/listings/route');
        const req = oversizedRequest(
            'http://localhost/api/marketplace/listings',
            JSON_BODY_LIMITS.marketplaceListingsCreate
        );

        const res = await POST(req, { params: {} });
        const body = await res.json();

        expect(res.status).toBe(413);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
});
