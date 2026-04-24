import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, OPTIONS, POST } from './route';
import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
  getMarketplaceSortKeys,
  isMarketplaceSortBy,
  listMarketplaceListings,
  marketplaceService,
} from '@/lib/backend/services/marketplace';
import { ValidationError, ConflictError } from '@/lib/backend/errors';
import type { MarketplaceListing } from '@/lib/types/domain';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => true),
}))

// Mock the marketplace service
vi.mock('@/lib/backend/services/marketplace', () => ({
  getMarketplaceSortKeys: vi.fn(() => ['amount', 'yield', 'price']),
  isMarketplaceSortBy: vi.fn(() => true),
  listMarketplaceListings: vi.fn(async () => []),
  marketplaceService: {
    createListing: vi.fn(),
  },
}));

describe('POST /api/marketplace/listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COMMITLABS_FIRST_PARTY_ORIGINS = 'https://app.commitlabs.test';
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(isMarketplaceSortBy).mockReturnValue(true);
    vi.mocked(getMarketplaceSortKeys).mockReturnValue(['amount', 'yield', 'price']);
    vi.mocked(listMarketplaceListings).mockResolvedValue([]);
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
      headers: {
        Origin: 'https://app.commitlabs.test',
      },
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://app.commitlabs.test'
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(data.success).toBe(true);
    expect(data.data.listing).toEqual(mockListing);
    expect(marketplaceService.createListing).toHaveBeenCalledWith(requestBody);
  });

  it('should expose public CORS headers on GET responses', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'GET',
      headers: {
        Origin: 'https://external.example',
      },
    });

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET, POST, OPTIONS'
    );
    expect(data.success).toBe(true);
  });

  it('should parse and forward supported marketplace filters', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/marketplace/listings?type=safe&minCompliance=80&maxLoss=12&minAmount=100&maxAmount=500&sortBy=yield',
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(listMarketplaceListings).toHaveBeenCalledWith({
      type: 'Safe',
      minCompliance: 80,
      maxLoss: 12,
      minAmount: 100,
      maxAmount: 500,
      sortBy: 'yield',
    });
  });

  it('should return 400 for invalid numeric filters', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/marketplace/listings?minCompliance=not-a-number',
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when minAmount exceeds maxAmount', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/marketplace/listings?minAmount=500&maxAmount=100',
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for unsupported commitment types', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/marketplace/listings?type=unknown',
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for unsupported sort fields', async () => {
    vi.mocked(isMarketplaceSortBy).mockReturnValue(false);

    const request = new NextRequest(
      'http://localhost:3000/api/marketplace/listings?sortBy=createdAt',
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(getMarketplaceSortKeys).toHaveBeenCalled();
  });

  it('should return 429 when GET rate limiting blocks the request', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'GET',
    });

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error.code).toBe('TOO_MANY_REQUESTS');
    expect(listMarketplaceListings).not.toHaveBeenCalled();
  });

  it('should reject disallowed first-party origins for POST', async () => {
    const requestBody = {
      commitmentId: 'commitment_123',
      price: '1000.50',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        Origin: 'https://evil.example',
      },
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(marketplaceService.createListing).not.toHaveBeenCalled();
  });

  it('should answer first-party POST preflight requests', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.commitlabs.test',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    const response = await OPTIONS(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://app.commitlabs.test'
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET, POST, OPTIONS'
    );
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

  it('should return 500 for unexpected service errors', async () => {
    vi.mocked(marketplaceService.createListing).mockRejectedValue(new Error('boom'));

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify({
        commitmentId: 'commitment_123',
        price: '1000.50',
        currencyAsset: 'USDC',
        sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      }),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });
});
