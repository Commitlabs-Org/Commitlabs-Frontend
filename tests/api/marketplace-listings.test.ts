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

vi.mock('@/lib/backend/jsonBodyLimit', () => ({
  parseJsonWithLimit: vi.fn(),
  JSON_BODY_LIMITS: { marketplaceListingsCreate: 1024 * 100 },
}));

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn(() => '192.168.1.100'),
}));

import { GET, POST } from '@/app/api/marketplace/listings/route';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { listMarketplaceListings, marketplaceService } from '@/lib/backend/services/marketplace';
import { parseJsonWithLimit } from '@/lib/backend/jsonBodyLimit';
import { CsrfValidationError } from '@/lib/backend/errors';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAssertMutationCsrf = vi.mocked(assertMutationCsrf);
const mockedListMarketplaceListings = vi.mocked(listMarketplaceListings);
const mockedCreateListing = vi.mocked(marketplaceService.createListing);
const mockedParseJsonWithLimit = vi.mocked(parseJsonWithLimit);

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
  });

  it('uses getClientIp for per-IP rate limiting', async () => {
    const response = await mockGET(
      createMockRequest('http://localhost:3000/api/marketplace/listings'),
      createMockRouteContext(),
    );
    await parseResponse(response);

    expect(mockedCheckRateLimit).toHaveBeenCalledTimes(1);
    const [identifier, bucket] = mockedCheckRateLimit.mock.calls[0];
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
});

describe('POST /api/marketplace/listings', () => {
  const LISTING_BODY = {
    commitmentId: 'cm_1',
    price: '1100',
    currencyAsset: 'USDC',
    sellerAddress: 'GABC123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedParseJsonWithLimit.mockResolvedValue(LISTING_BODY);
    mockedCreateListing.mockResolvedValue({
      id: 'lst_1',
      ...LISTING_BODY,
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
    const [identifier, bucket] = mockedCheckRateLimit.mock.calls[0];
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

  it('calls createListing with the parsed body', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {});

    await mockPOST(
      createMockRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        body: LISTING_BODY,
      }),
      createMockRouteContext(),
    );

    expect(mockedCreateListing).toHaveBeenCalledWith(LISTING_BODY);
  });
});
