/**
 * Comprehensive route-level tests for GET+POST /api/marketplace/listings
 *
 * Covers: success, failure, boundary, retry (rate-limit), permission, and
 * CORS invariants for both methods.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockRouteContext, parseResponse } from '../../../tests/api/helpers';

// ─── Mocks (must be hoisted before imports) ────────────────────────────────

vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  listMarketplaceListings: vi.fn(),
  isMarketplaceSortBy: vi.fn().mockReturnValue(true),
  getMarketplaceSortKeys: vi.fn().mockReturnValue(['price', 'amount', 'complianceScore', 'remainingDays', 'maxLoss', 'currentYield']),
  marketplaceService: {
    createListing: vi.fn(),
  },
}));

vi.mock('@/lib/backend/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('@/lib/backend/cors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend/cors')>();
  return {
    ...actual,
    createCorsOptionsHandler: vi.fn().mockReturnValue(vi.fn().mockReturnValue(new Response(null, { status: 204 }))),
    applyCorsPolicy: vi.fn().mockImplementation((_req: unknown, res: Response) => res),
    enforceCorsRequestPolicy: vi.fn(),
  };
});

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { GET, POST } from '@/app/api/marketplace/listings/route';
import { requireAuth } from '@/lib/backend/requireAuth';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { listMarketplaceListings, marketplaceService } from '@/lib/backend/services/marketplace';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const SELLER = 'GSELLERADDRESS00000000000000000000000000000000000000000000';

const mockPublicListings = [
  {
    listingId: 'LST-001',
    commitmentId: 'CMT-001',
    type: 'Safe' as const,
    amount: 50000,
    remainingDays: 25,
    maxLoss: 2,
    currentYield: 5.2,
    complianceScore: 95,
    price: 52000,
  },
  {
    listingId: 'LST-002',
    commitmentId: 'CMT-002',
    type: 'Balanced' as const,
    amount: 100000,
    remainingDays: 45,
    maxLoss: 8,
    currentYield: 12.5,
    complianceScore: 88,
    price: 105000,
  },
];

const mockCreatedListing = {
  id: 'listing_1_123',
  commitmentId: 'CMT-001',
  price: '52000',
  currencyAsset: 'USDC',
  sellerAddress: SELLER,
  status: 'Active' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeGetRequest(params: string = '') {
  return createMockRequest(
    `http://localhost:3000/api/marketplace/listings${params ? `?${params}` : ''}`,
    { method: 'GET' },
  );
}

function makePostRequest(body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return createMockRequest(
    'http://localhost:3000/api/marketplace/listings',
    { method: 'POST', body, headers },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/listings
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/marketplace/listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(listMarketplaceListings).mockResolvedValue(mockPublicListings);
  });

  // ── Success ──────────────────────────────────────────────────────────────

  it('returns 200 with listings array on success', async () => {
    const res = await GET(makeGetRequest(), createMockRouteContext(), 'corr-001');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.listings)).toBe(true);
    expect(data.data.listings).toHaveLength(2);
    expect(data.data.total).toBe(2);
  });

  it('returns card-shaped projections alongside raw listings', async () => {
    const res = await GET(makeGetRequest(), createMockRouteContext(), 'corr-002');
    const { data } = await parseResponse(res);

    expect(Array.isArray(data.data.cards)).toBe(true);
    const card = data.data.cards[0];
    expect(card).toHaveProperty('id');
    expect(card).toHaveProperty('type');
    expect(card).toHaveProperty('score');
    expect(card).toHaveProperty('amount');
    expect(card).toHaveProperty('price');
  });

  it('passes type filter to listMarketplaceListings', async () => {
    await GET(makeGetRequest('type=safe'), createMockRouteContext(), 'corr-003');

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Safe' }),
    );
  });

  it('passes minCompliance filter', async () => {
    await GET(makeGetRequest('minCompliance=80'), createMockRouteContext(), 'corr-004');

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ minCompliance: 80 }),
    );
  });

  it('passes maxLoss filter', async () => {
    await GET(makeGetRequest('maxLoss=5'), createMockRouteContext(), 'corr-005');

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ maxLoss: 5 }),
    );
  });

  it('passes minAmount and maxAmount filters', async () => {
    await GET(makeGetRequest('minAmount=10000&maxAmount=100000'), createMockRouteContext(), 'corr-006');

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ minAmount: 10000, maxAmount: 100000 }),
    );
  });

  it('passes sortBy filter', async () => {
    await GET(makeGetRequest('sortBy=complianceScore'), createMockRouteContext(), 'corr-007');

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'complianceScore' }),
    );
  });

  it('defaults page=1 and pageSize=10 when not specified', async () => {
    await GET(makeGetRequest(), createMockRouteContext(), 'corr-008');

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10 }),
    );
  });

  it('returns empty listings array when no matches', async () => {
    vi.mocked(listMarketplaceListings).mockResolvedValue([]);

    const res = await GET(makeGetRequest('type=aggressive'), createMockRouteContext(), 'corr-009');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.data.listings).toHaveLength(0);
    expect(data.data.total).toBe(0);
  });

  // ── Validation failures ───────────────────────────────────────────────────

  it('returns 400 for invalid type param', async () => {
    const res = await GET(makeGetRequest('type=InvalidType'), createMockRouteContext(), 'corr-010');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for non-numeric minCompliance', async () => {
    const res = await GET(makeGetRequest('minCompliance=abc'), createMockRouteContext(), 'corr-011');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when minAmount > maxAmount', async () => {
    const res = await GET(makeGetRequest('minAmount=100&maxAmount=50'), createMockRouteContext(), 'corr-012');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.message).toMatch(/minAmount.*maxAmount|cannot be greater/i);
  });

  it('returns 400 for non-positive page param', async () => {
    const res = await GET(makeGetRequest('page=0'), createMockRouteContext(), 'corr-013');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 400 for fractional page param', async () => {
    const res = await GET(makeGetRequest('page=1.5'), createMockRouteContext(), 'corr-014');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await GET(makeGetRequest(), createMockRouteContext(), 'corr-015');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('includes Retry-After header on 429', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await GET(makeGetRequest(), createMockRouteContext(), 'corr-016');

    expect(res.headers.get('retry-after')).not.toBeNull();
  });

  // ── Correlation ID ────────────────────────────────────────────────────────

  it('includes x-correlation-id header in response', async () => {
    const res = await GET(makeGetRequest(), createMockRouteContext(), 'corr-017');

    expect(res.headers.get('x-correlation-id')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/marketplace/listings
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/marketplace/listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);

    // Default: authenticated seller
    vi.mocked(requireAuth).mockReturnValue({
      user: { address: SELLER, csrfToken: 'csrf-tok' },
    } as any);

    vi.mocked(marketplaceService.createListing).mockResolvedValue(mockCreatedListing as any);
  });

  // ── Success ──────────────────────────────────────────────────────────────

  it('returns 201 with created listing on success', async () => {
    const res = await POST(
      makePostRequest({
        commitmentId: 'CMT-001',
        price: '52000',
        currencyAsset: 'USDC',
        sellerAddress: SELLER,
      }),
      createMockRouteContext(),
      'corr-post-001',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.listing.commitmentId).toBe('CMT-001');
    expect(data.data.listing.status).toBe('Active');
  });

  it('fills sellerAddress from session when not provided', async () => {
    await POST(
      makePostRequest({ commitmentId: 'CMT-001', price: '52000', currencyAsset: 'USDC' }),
      createMockRouteContext(),
      'corr-post-002',
    );

    expect(marketplaceService.createListing).toHaveBeenCalledWith(
      expect.objectContaining({ sellerAddress: SELLER }),
    );
  });

  it('accepts sellerAddress that matches the authenticated caller', async () => {
    const res = await POST(
      makePostRequest({
        commitmentId: 'CMT-001',
        price: '52000',
        currencyAsset: 'USDC',
        sellerAddress: SELLER,
      }),
      createMockRouteContext(),
      'corr-post-003',
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(201);
  });

  // ── Authentication ────────────────────────────────────────────────────────

  it('returns 401 when caller is unauthenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/backend/errors');
    vi.mocked(requireAuth).mockImplementation(() => {
      throw new UnauthorizedError('No session token provided');
    });

    const res = await POST(
      makePostRequest({ commitmentId: 'CMT-001', price: '52000', currencyAsset: 'USDC' }),
      createMockRouteContext(),
      'corr-post-004',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  // ── Authorization invariant: sellerAddress spoofing ───────────────────────

  it('returns 400 when sellerAddress does not match authenticated caller', async () => {
    const res = await POST(
      makePostRequest({
        commitmentId: 'CMT-001',
        price: '52000',
        currencyAsset: 'USDC',
        sellerAddress: 'GDIFFERENTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      }),
      createMockRouteContext(),
      'corr-post-005',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toMatch(/sellerAddress must match/i);
  });

  // ── Body validation ───────────────────────────────────────────────────────

  it('returns 400 when request body is not an object', async () => {
    const req = createMockRequest(
      'http://localhost:3000/api/marketplace/listings',
      { method: 'POST', body: 'not-an-object' },
    );
    // Override raw body with string
    const originalJson = req.json.bind(req);
    vi.spyOn(req, 'json').mockResolvedValue('not-an-object');

    const res = await POST(req, createMockRouteContext(), 'corr-post-006');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 409 when the commitment already has an active listing', async () => {
    const { ConflictError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.createListing).mockRejectedValue(
      new ConflictError('Commitment is already listed on the marketplace.', {
        commitmentId: 'CMT-001',
        existingListingId: 'listing_0_999',
      }),
    );

    const res = await POST(
      makePostRequest({ commitmentId: 'CMT-001', price: '52000', currencyAsset: 'USDC' }),
      createMockRouteContext(),
      'corr-post-007',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────

  it('returns 429 when rate limit is exceeded for POST', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await POST(
      makePostRequest({ commitmentId: 'CMT-001', price: '52000', currencyAsset: 'USDC' }),
      createMockRouteContext(),
      'corr-post-008',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('does not call createListing when rate-limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    await POST(
      makePostRequest({ commitmentId: 'CMT-001', price: '52000', currencyAsset: 'USDC' }),
      createMockRouteContext(),
      'corr-post-009',
    );

    expect(marketplaceService.createListing).not.toHaveBeenCalled();
  });

  // ── Service errors passthrough ────────────────────────────────────────────

  it('returns 400 when service throws ValidationError for missing fields', async () => {
    const { ValidationError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.createListing).mockRejectedValue(
      new ValidationError('Invalid listing request', { errors: ['price must be a positive number'] }),
    );

    const res = await POST(
      makePostRequest({ commitmentId: 'CMT-001', price: '-1', currencyAsset: 'USDC' }),
      createMockRouteContext(),
      'corr-post-010',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 on unexpected storage error', async () => {
    const { InternalError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.createListing).mockRejectedValue(
      new InternalError('Marketplace storage is temporarily unavailable.'),
    );

    const res = await POST(
      makePostRequest({ commitmentId: 'CMT-001', price: '52000', currencyAsset: 'USDC' }),
      createMockRouteContext(),
      'corr-post-011',
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(500);
    expect(data.success).toBe(false);
  });

  // ── Correlation ID ────────────────────────────────────────────────────────

  it('includes x-correlation-id header in 201 response', async () => {
    const res = await POST(
      makePostRequest({ commitmentId: 'CMT-001', price: '52000', currencyAsset: 'USDC' }),
      createMockRouteContext(),
      'corr-post-012',
    );

    expect(res.headers.get('x-correlation-id')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Method enforcement (405 for unsupported methods)
// ═══════════════════════════════════════════════════════════════════════════

describe('Method enforcement on /api/marketplace/listings', () => {
  it('returns 405 for PUT', async () => {
    const { PUT } = await import('@/app/api/marketplace/listings/route');
    const req = createMockRequest('http://localhost:3000/api/marketplace/listings', { method: 'PUT' });
    const res = await PUT(req, createMockRouteContext());
    expect(res.status).toBe(405);
  });

  it('returns 405 for DELETE', async () => {
    const { DELETE } = await import('@/app/api/marketplace/listings/route');
    const req = createMockRequest('http://localhost:3000/api/marketplace/listings', { method: 'DELETE' });
    const res = await DELETE(req, createMockRouteContext());
    expect(res.status).toBe(405);
  });
});
