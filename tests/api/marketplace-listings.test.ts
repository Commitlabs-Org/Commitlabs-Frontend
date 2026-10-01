/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseResponse, createMockRouteContext } from './helpers';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn(() => 60),
}));

vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));

vi.mock('@/lib/backend/services/marketplace', () => ({
  listMarketplaceListings: vi.fn(),
  marketplaceService: { createListing: vi.fn() },
  isMarketplaceSortBy: vi.fn(() => true),
  getMarketplaceSortKeys: vi.fn(() => ['price', 'yield', 'compliance']),
}));

vi.mock('@/lib/backend/idempotency', () => ({
  idempotencyService: {
    getRecord: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
  },
}));

vi.mock('@/lib/backend/jsonBodyLimit', () => ({
  parseJsonWithLimit: vi.fn(),
  JSON_BODY_LIMITS: { marketplaceListingsCreate: 1024 * 100 },
}));

vi.mock('@/lib/backend/requireAuth', () => ({
  verifyAuth: vi.fn(),
}));

vi.mock('@stellar/stellar-sdk', () => ({
  default: {
    StrKey: {
      isValidEd25519PublicKey: vi.fn((address: string) => /^G[A-Z2-7]{55}$/.test(address)),
    },
  },
}));

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn(() => '192.168.1.100'),
}));

import { GET, POST } from '@/app/api/marketplace/listings/route';
import type { NextRequest } from 'next/server';
import { MAX_PAGE_SIZE } from '@/lib/backend/pagination';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { listMarketplaceListings, marketplaceService } from '@/lib/backend/services/marketplace';
import { parseJsonWithLimit } from '@/lib/backend/jsonBodyLimit';
import { idempotencyService } from '@/lib/backend/idempotency';
import { CsrfValidationError } from '@/lib/backend/errors';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAssertMutationCsrf = vi.mocked(assertMutationCsrf);
const mockedListMarketplaceListings = vi.mocked(listMarketplaceListings);
const mockedCreateListing = vi.mocked(marketplaceService.createListing);
const mockedParseJsonWithLimit = vi.mocked(parseJsonWithLimit);
const mockedIdempotencyGetRecord = vi.mocked(idempotencyService.getRecord);
const mockedIdempotencyStart = vi.mocked(idempotencyService.start);

const mockGET = GET as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

const mockPOST = POST as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

const SAMPLE_LISTING = {
  listingId: 'lst_1',
  commitmentId: 'cm_1',
  type: 'Safe' as const,
  amount: 1000,
  remainingDays: 30,
  maxLoss: 5,
  currentYield: 12,
  complianceScore: 90,
  price: 1100,
};

describe('GET /api/marketplace/listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedListMarketplaceListings.mockResolvedValue([SAMPLE_LISTING] as any);
    mockedIdempotencyGetRecord.mockResolvedValue(null);
    mockedIdempotencyStart.mockResolvedValue(true);
  });

  it('uses getClientIp for per-IP rate limiting', async () => {
    const response = await mockGET(
      createMockRequest('http://localhost:3000/api/marketplace/listings'),
      createMockRouteContext(),
    );
    await parseResponse(response);

    expect(mockedCheckRateLimit).toHaveBeenCalledTimes(1);
    const [identifier, bucket] = mockedCheckRateLimit.mock.calls[0]!;
    expect(identifier).not.toBe('anonymous');
    expect(typeof identifier).toBe('string');
    expect(identifier.length).toBeGreaterThan(0);
    expect(bucket).toBe('api/marketplace/listings');
  });

  it('returns 429 when rate limited', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const response = await mockGET(
      createMockRequest('http://localhost:3000/api/marketplace/listings'),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(429);
  });

  it('returns 200 with listings on success', async () => {
    const response = await mockGET(
      createMockRequest('http://localhost:3000/api/marketplace/listings'),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.listings).toHaveLength(1);
    expect(result.data.data.cards).toHaveLength(1);
  });

  it('rejects a pageSize above MAX_PAGE_SIZE to bound response size', async () => {
    const response = await mockGET(
      createMockRequest(
        `http://localhost:3000/api/marketplace/listings?pageSize=${MAX_PAGE_SIZE + 1}`,
      ),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts a pageSize within MAX_PAGE_SIZE', async () => {
    const response = await mockGET(
      createMockRequest(`http://localhost:3000/api/marketplace/listings?pageSize=${MAX_PAGE_SIZE}`),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
  });
});

describe('POST /api/marketplace/listings', () => {
  const SELLER_ADDRESS = `G${'A'.repeat(55)}`;
  const OTHER_ADDRESS = `G${'B'.repeat(55)}`;
  const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
  const LISTING_BODY = {
    commitmentId: 'cm_1',
    price: '1100',
    currencyAsset: 'USDC',
    sellerAddress: SELLER_ADDRESS,
    networkPassphrase: NETWORK_PASSPHRASE,
  };
  const SERVICE_LISTING_BODY = {
    commitmentId: LISTING_BODY.commitmentId,
    price: LISTING_BODY.price,
    currencyAsset: LISTING_BODY.currencyAsset,
    sellerAddress: LISTING_BODY.sellerAddress,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedVerifyAuth.mockReturnValue({ address: SELLER_ADDRESS, isAdmin: false });
    mockedParseJsonWithLimit.mockResolvedValue(LISTING_BODY);
    mockedIdempotencyGetRecord.mockResolvedValue(null);
    mockedIdempotencyStart.mockResolvedValue(true);
    mockedCreateListing.mockResolvedValue({
      id: 'lst_1',
      ...SERVICE_LISTING_BODY,
      status: 'Active',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    } as any);
  });

  it('rejects requests without a valid CSRF token', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {
      throw new CsrfValidationError('Missing CSRF token.', { reason: 'missing_header' });
    });

    const response = await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: LISTING_BODY,
      }),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(403);
    expect(result.data.error.code).toBe('CSRF_INVALID');
  });

  it('applies per-IP rate limiting', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});

    await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: LISTING_BODY,
      }),
      createMockRouteContext(),
    );

    expect(mockedCheckRateLimit).toHaveBeenCalledTimes(1);
    const [identifier, bucket] = mockedCheckRateLimit.mock.calls[0]!;
    expect(typeof identifier).toBe('string');
    expect(identifier.length).toBeGreaterThan(0);
    expect(bucket).toBe('api/marketplace/listings/create');
  });

  it('returns 429 when rate limited', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});
    mockedCheckRateLimit.mockResolvedValue(false);

    const response = await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: LISTING_BODY,
      }),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(429);
  });

  it('returns 201 on successful listing creation', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});

    const response = await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: LISTING_BODY,
      }),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);
    expect(result.status).toBe(201);
    expect(result.data.success).toBe(true);
    expect(result.data.data.listing).toBeDefined();
  });

  it('calls createListing with the validated listing data only', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});

    await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: LISTING_BODY,
      }),
      createMockRouteContext(),
    );

    expect(mockedCreateListing).toHaveBeenCalledWith(SERVICE_LISTING_BODY);
  });

  it('returns 401 when the wallet is disconnected', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});
    mockedVerifyAuth.mockImplementation(() => {
      throw new UnauthorizedError('Bearer token required');
    });

    const response = await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: LISTING_BODY,
      }),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(401);
    expect(result.data.error.code).toBe('UNAUTHORIZED');
    expect(mockedCreateListing).not.toHaveBeenCalled();
  });

  it('rejects body seller tampering against the authenticated session', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});
    mockedVerifyAuth.mockReturnValue({ address: OTHER_ADDRESS, isAdmin: false });

    const response = await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: LISTING_BODY,
      }),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(403);
    expect(result.data.error.code).toBe('FORBIDDEN');
    expect(mockedCreateListing).not.toHaveBeenCalled();
  });

  it('rejects malformed numeric prices at the boundary', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});
    mockedParseJsonWithLimit.mockResolvedValue({ ...LISTING_BODY, price: '-1' });

    const response = await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: { ...LISTING_BODY, price: '-1' },
      }),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
    expect(mockedCreateListing).not.toHaveBeenCalled();
  });

  it('rejects wrong-network listing creation', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});
    mockedParseJsonWithLimit.mockResolvedValue({
      ...LISTING_BODY,
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    });

    const response = await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: {
          ...LISTING_BODY,
          networkPassphrase: 'Public Global Stellar Network ; September 2015',
        },
      }),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
    expect(mockedCreateListing).not.toHaveBeenCalled();
  });

  it('rejects unexpected request fields before service calls', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});
    mockedParseJsonWithLimit.mockResolvedValue({ ...LISTING_BODY, status: 'Sold' });

    const response = await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: { ...LISTING_BODY, status: 'Sold' },
      }),
      createMockRouteContext(),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
    expect(mockedCreateListing).not.toHaveBeenCalled();
  });

  it('returns the cached response for a completed idempotency key', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});
    mockedIdempotencyGetRecord.mockResolvedValue({
      key: 'listing-key',
      status: 'COMPLETED',
      response: { listing: { id: 'lst_replay', status: 'Active' } },
      statusCode: 201,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    });

    const response = await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'idempotency-key': 'listing-key' },
        body: LISTING_BODY,
      }),
      createMockRouteContext(),
    );

    const result = await parseResponse(response);
    expect(result.status).toBe(201);
    expect(result.data.data.listing.id).toBe('lst_replay');
    expect(mockedCreateListing).not.toHaveBeenCalled();
  });

  it('rejects duplicate in-flight create requests using the same idempotency key', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});
    mockedIdempotencyGetRecord.mockResolvedValue({
      key: 'listing-key',
      status: 'STARTED',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    });

    const response = await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'idempotency-key': 'listing-key' },
        body: LISTING_BODY,
      }),
      createMockRouteContext(),
    );

    const result = await parseResponse(response);
    expect(result.status).toBe(429);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
