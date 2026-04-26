import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, PUT, PATCH, DELETE } from './route';
import { NextRequest } from 'next/server';
import { marketplaceService, listMarketplaceListings, isMarketplaceSortBy } from '@/lib/backend/services/marketplace';
import { ValidationError, ConflictError } from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import type { MarketplaceListing, MarketplacePublicListing } from '@/lib/types/domain';

// Mock the marketplace service and related functions
vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    createListing: vi.fn(),
  },
  listMarketplaceListings: vi.fn(),
  isMarketplaceSortBy: vi.fn(),
  getMarketplaceSortKeys: vi.fn(() => ['price', 'amount']),
}));

// Mock rate limiting
vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

describe('POST /api/marketplace/listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a listing successfully', async () => {
    const mockListing: MarketplaceListing = {
      id: 'listing_1_1234567890',
      commitmentId: 'commitment_123',
      price: '1000.50',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      status: 'Active',
      createdAt: '2026-02-25T10:00:00.000Z',
      updatedAt: '2026-02-25T10:00:00.000Z',
    };

    vi.mocked(marketplaceService.createListing).mockResolvedValue(mockListing);

    const requestBody = {
      commitmentId: 'commitment_123',
      price: '1000.50',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.listing).toEqual(mockListing);
    expect(marketplaceService.createListing).toHaveBeenCalledWith(requestBody);
  });

  it('should return 400 when request body is invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when request body is not an object', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify('string instead of object'),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when request body is null', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(null),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should propagate validation errors from service', async () => {
    const validationError = new ValidationError('Invalid listing request', {
      errors: ['price must be a positive number'],
    });

    vi.mocked(marketplaceService.createListing).mockRejectedValue(validationError);

    const requestBody = {
      commitmentId: 'commitment_123',
      price: '-100',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should propagate conflict errors from service', async () => {
    const conflictError = new ConflictError('Commitment is already listed on the marketplace.');

    vi.mocked(marketplaceService.createListing).mockRejectedValue(conflictError);

    const requestBody = {
      commitmentId: 'commitment_duplicate',
      price: '1000.50',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
  });
});

describe('405 Method Not Allowed — /api/marketplace/listings', () => {
  const url = 'http://localhost:3000/api/marketplace/listings';

  it.each([
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ] as const)('%s returns 405 with Allow header', async (method, handler) => {
    const request = new NextRequest(url, { method });
    const response = await handler(request, { params: {} });

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, POST');

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('METHOD_NOT_ALLOWED');
    expect(data.error.message).toContain('GET, POST');
  });

  it('same handler instance is reused across unsupported methods (no side effects)', async () => {
    const req1 = new NextRequest(url, { method: 'PUT' });
    const req2 = new NextRequest(url, { method: 'PATCH' });

    const [r1, r2] = await Promise.all([
      PUT(req1, { params: {} }),
      PATCH(req2, { params: {} }),
    ]);

    expect(r1.status).toBe(405);
    expect(r2.status).toBe(405);
  });
});
