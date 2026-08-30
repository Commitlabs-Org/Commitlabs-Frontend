import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  listMarketplaceListings: vi.fn(),
  marketplaceService: {
    createListing: vi.fn(),
  },
  isMarketplaceSortBy: vi.fn((v: string) =>
    ['price', 'amount', 'complianceScore', 'remainingDays', 'maxLoss', 'currentYield'].includes(v),
  ),
  getMarketplaceSortKeys: vi.fn(() => [
    'price', 'amount', 'complianceScore', 'remainingDays', 'maxLoss', 'currentYield',
  ]),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET, POST } from '@/app/api/marketplace/listings/route';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { listMarketplaceListings, marketplaceService } from '@/lib/backend/services/marketplace';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_LISTING_A = {
  listingId: 'LST-001',
  commitmentId: 'CMT-001',
  type: 'Safe' as const,
  amount: 50000,
  remainingDays: 25,
  maxLoss: 2,
  currentYield: 5.2,
  complianceScore: 95,
  price: 52000,
};

const MOCK_LISTING_B = {
  listingId: 'LST-002',
  commitmentId: 'CMT-002',
  type: 'Balanced' as const,
  amount: 100000,
  remainingDays: 45,
  maxLoss: 8,
  currentYield: 12.5,
  complianceScore: 88,
  price: 105000,
};

const CREATED_LISTING = {
  id: 'listing_1_1234',
  commitmentId: 'CMT-XYZ',
  price: '5000',
  currencyAsset: 'USDC',
  sellerAddress: 'GSELLER00000000000000000000000000000000000000000000000000',
  status: 'Active' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeGetRequest(queryString = '') {
  return createMockRequest(
    `http://localhost:3000/api/marketplace/listings${queryString ? `?${queryString}` : ''}`,
    { method: 'GET' },
  );
}

function makePostRequest(body: Record<string, unknown>) {
  return createMockRequest('http://localhost:3000/api/marketplace/listings', {
    method: 'POST',
    body,
  });
}

// ─── GET /api/marketplace/listings ───────────────────────────────────────────

describe('GET /api/marketplace/listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(listMarketplaceListings).mockResolvedValue([MOCK_LISTING_A, MOCK_LISTING_B]);
  });

  // ── Success ──────────────────────────────────────────────────────────────

  it('returns 200 with listings array and cards array', async () => {
    const res = await GET(makeGetRequest(), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.listings)).toBe(true);
    expect(Array.isArray(data.data.cards)).toBe(true);
    expect(data.data.total).toBe(2);
  });

  it('returns 200 with empty arrays when no listings match', async () => {
    vi.mocked(listMarketplaceListings).mockResolvedValue([]);

    const res = await GET(makeGetRequest(), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.data.listings).toHaveLength(0);
    expect(data.data.cards).toHaveLength(0);
    expect(data.data.total).toBe(0);
  });

  it('cards array has the same length as listings array', async () => {
    const res = await GET(makeGetRequest(), createMockRouteContext());
    const { data } = await parseResponse(res);

    expect(data.data.cards).toHaveLength(data.data.listings.length);
  });

  it('each card exposes the required display fields', async () => {
    const res = await GET(makeGetRequest(), createMockRouteContext());
    const { data } = await parseResponse(res);

    const card = data.data.cards[0];
    expect(card).toHaveProperty('id');
    expect(card).toHaveProperty('type');
    expect(card).toHaveProperty('score');
    expect(card).toHaveProperty('amount');
    expect(card).toHaveProperty('duration');
    expect(card).toHaveProperty('yield');
    expect(card).toHaveProperty('maxLoss');
    expect(card).toHaveProperty('price');
  });

  it('includes correlation ID header in response', async () => {
    const res = await GET(makeGetRequest(), createMockRouteContext());
    expect(
      res.headers.get('x-correlation-id') || res.headers.get('x-request-id'),
    ).toBeTruthy();
  });

  // ── Query parameter parsing ───────────────────────────────────────────────

  it('passes type filter to listMarketplaceListings', async () => {
    await GET(makeGetRequest('type=safe'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Safe' }),
    );
  });

  it('normalizes type filter case-insensitively (BALANCED → Balanced)', async () => {
    await GET(makeGetRequest('type=BALANCED'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Balanced' }),
    );
  });

  it('normalizes type filter (aggressive → Aggressive)', async () => {
    await GET(makeGetRequest('type=aggressive'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Aggressive' }),
    );
  });

  it('passes minCompliance numeric filter', async () => {
    await GET(makeGetRequest('minCompliance=90'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ minCompliance: 90 }),
    );
  });

  it('passes maxLoss numeric filter', async () => {
    await GET(makeGetRequest('maxLoss=5'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ maxLoss: 5 }),
    );
  });

  it('passes minAmount and maxAmount range filters', async () => {
    await GET(makeGetRequest('minAmount=10000&maxAmount=200000'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ minAmount: 10000, maxAmount: 200000 }),
    );
  });

  it('defaults page to 1 and pageSize to 10', async () => {
    await GET(makeGetRequest(), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10 }),
    );
  });

  it('forwards explicit page and pageSize', async () => {
    await GET(makeGetRequest('page=2&pageSize=5'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 5 }),
    );
  });

  it('forwards valid sortBy param', async () => {
    await GET(makeGetRequest('sortBy=complianceScore'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'complianceScore' }),
    );
  });

  // ── Validation errors ─────────────────────────────────────────────────────

  it('returns 400 when type is invalid', async () => {
    const res = await GET(makeGetRequest('type=InvalidType'), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when minAmount is not a number', async () => {
    const res = await GET(makeGetRequest('minAmount=abc'), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 400 when maxAmount is not a number', async () => {
    const res = await GET(makeGetRequest('maxAmount=abc'), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 400 when minAmount > maxAmount', async () => {
    const res = await GET(makeGetRequest('minAmount=200000&maxAmount=100000'), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.message).toContain("'minAmount' cannot be greater than 'maxAmount'");
  });

  it('returns 400 when page is not a positive integer', async () => {
    const res = await GET(makeGetRequest('page=0'), createMockRouteContext());
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it('returns 400 when pageSize is not a positive integer', async () => {
    const res = await GET(makeGetRequest('pageSize=-1'), createMockRouteContext());
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it('returns 400 when sortBy is invalid', async () => {
    const res = await GET(makeGetRequest('sortBy=invalidKey'), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.error.message).toContain('sortBy');
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await GET(makeGetRequest(), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('returns Retry-After header when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await GET(makeGetRequest(), createMockRouteContext());

    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  // ── Service errors ────────────────────────────────────────────────────────

  it('returns 500 when listMarketplaceListings throws unexpectedly', async () => {
    vi.mocked(listMarketplaceListings).mockRejectedValue(new Error('Storage unavailable'));

    const res = await GET(makeGetRequest(), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(500);
    expect(data.success).toBe(false);
  });

  // ── Boundary conditions ───────────────────────────────────────────────────

  it('accepts minAmount equal to maxAmount (single-point range)', async () => {
    await GET(makeGetRequest('minAmount=50000&maxAmount=50000'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ minAmount: 50000, maxAmount: 50000 }),
    );
  });

  it('accepts minCompliance=0 (boundary: zero compliance)', async () => {
    await GET(makeGetRequest('minCompliance=0'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ minCompliance: 0 }),
    );
  });

  it('accepts maxLoss=100 (boundary: maximum loss)', async () => {
    await GET(makeGetRequest('maxLoss=100'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ maxLoss: 100 }),
    );
  });

  it('accepts fractional numeric params (e.g. minCompliance=85.5)', async () => {
    await GET(makeGetRequest('minCompliance=85.5'), createMockRouteContext());

    expect(listMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ minCompliance: 85.5 }),
    );
  });

  it('ignores unknown query parameters', async () => {
    const res = await GET(makeGetRequest('unknownParam=value'), createMockRouteContext());
    const { status } = await parseResponse(res);

    // Unknown params should not cause an error
    expect(status).toBe(200);
  });

  // ── ETag conditional request ──────────────────────────────────────────────

  it('returns ETag header on 200 responses', async () => {
    const res = await GET(makeGetRequest(), createMockRouteContext());

    expect(res.headers.get('ETag')).toBeTruthy();
    expect(res.headers.get('ETag')).toMatch(/^"[a-f0-9]{64}"$/);
  });

  it('includes Cache-Control header on 200 responses with ETag', async () => {
    const res = await GET(makeGetRequest(), createMockRouteContext());

    // The ETag path in withApiHandler adds Cache-Control when an ETag is set
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
  });

  // Note: The full 304 conditional-request path (If-None-Match → 304) is
  // tested at the withApiHandler layer in tests/api/withApiHandler.etag.test.ts
  // where the timestamp and correlationId can be controlled. In the route test
  // layer, both are dynamic (randomBytes + Date.now) so two sequential calls
  // necessarily produce different ETags.
});

// ─── POST /api/marketplace/listings ──────────────────────────────────────────

describe('POST /api/marketplace/listings', () => {
  const validBody = {
    commitmentId: 'CMT-XYZ',
    price: '5000',
    currencyAsset: 'USDC',
    sellerAddress: 'GSELLER00000000000000000000000000000000000000000000000000',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(marketplaceService.createListing).mockResolvedValue(CREATED_LISTING as unknown as Awaited<ReturnType<typeof marketplaceService.createListing>>);
  });

  // ── Success ──────────────────────────────────────────────────────────────

  it('returns 201 with created listing on success', async () => {
    const res = await POST(makePostRequest(validBody), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.listing).toBeDefined();
    expect(data.data.listing.id).toBe(CREATED_LISTING.id);
  });

  it('calls createListing with the request body', async () => {
    await POST(makePostRequest(validBody), createMockRouteContext());

    expect(marketplaceService.createListing).toHaveBeenCalledWith(
      expect.objectContaining({
        commitmentId: 'CMT-XYZ',
        price: '5000',
        currencyAsset: 'USDC',
        sellerAddress: 'GSELLER00000000000000000000000000000000000000000000000000',
      }),
    );
  });

  it('includes correlation ID in 201 response', async () => {
    const res = await POST(makePostRequest(validBody), createMockRouteContext());
    expect(
      res.headers.get('x-correlation-id') || res.headers.get('x-request-id'),
    ).toBeTruthy();
  });

  // ── Conflict (duplicate listing) ─────────────────────────────────────────

  it('returns 409 when commitment is already listed (ConflictError)', async () => {
    const { ConflictError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.createListing).mockRejectedValue(
      new ConflictError('Commitment is already listed on the marketplace.', {
        commitmentId: 'CMT-XYZ',
        existingListingId: 'listing_old',
      }),
    );

    const res = await POST(makePostRequest(validBody), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
  });

  it('409 response message indicates the commitment is already listed', async () => {
    const { ConflictError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.createListing).mockRejectedValue(
      new ConflictError('Commitment is already listed on the marketplace.', {
        commitmentId: 'CMT-XYZ',
        existingListingId: 'listing_old',
      }),
    );

    const res = await POST(makePostRequest(validBody), createMockRouteContext());
    const { data } = await parseResponse(res);

    expect(data.error.message).toContain('already listed');
  });

  // ── Request body validation ───────────────────────────────────────────────

  it('returns 400 when body is missing entirely', async () => {
    const req = createMockRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
    });
    const res = await POST(req, createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 400 when service throws ValidationError (missing fields)', async () => {
    const { ValidationError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.createListing).mockRejectedValue(
      new ValidationError('Invalid listing request', {
        errors: ['commitmentId is required and must be a string'],
      }),
    );

    const res = await POST(makePostRequest({ ...validBody, commitmentId: '' }), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 400 when service throws ValidationError (price not positive)', async () => {
    const { ValidationError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.createListing).mockRejectedValue(
      new ValidationError('Invalid listing request', {
        errors: ['price must be a positive number'],
      }),
    );

    const res = await POST(makePostRequest({ ...validBody, price: '-1' }), createMockRouteContext());
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  // ── Service errors ────────────────────────────────────────────────────────

  it('returns 500 when storage is unavailable', async () => {
    const { InternalError } = await import('@/lib/backend/errors');
    vi.mocked(marketplaceService.createListing).mockRejectedValue(
      new InternalError('Marketplace storage is temporarily unavailable. Please try again later.'),
    );

    const res = await POST(makePostRequest(validBody), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(500);
    expect(data.success).toBe(false);
  });

  it('returns 500 on unexpected service error', async () => {
    vi.mocked(marketplaceService.createListing).mockRejectedValue(
      new Error('Unexpected crash'),
    );

    const res = await POST(makePostRequest(validBody), createMockRouteContext());
    const { status, data } = await parseResponse(res);

    expect(status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });

  // ── Method enforcement ────────────────────────────────────────────────────

  it('route module exports PUT/PATCH/DELETE as 405 handlers', async () => {
    const { PUT, PATCH, DELETE } = await import('@/app/api/marketplace/listings/route');
    expect(typeof PUT).toBe('function');
    expect(typeof PATCH).toBe('function');
    expect(typeof DELETE).toBe('function');

    const putRes = await PUT(makePostRequest(validBody) as unknown as Parameters<typeof PUT>[0], createMockRouteContext());
    expect(putRes.status).toBe(405);
  });
});
