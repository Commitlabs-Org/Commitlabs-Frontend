import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { ValidationError, ConflictError } from '@/lib/backend/errors';
import type { MarketplaceListing } from '@/types/marketplace';

// Mock the marketplace service
vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    createListing: vi.fn(),
  },
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
