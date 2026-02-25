import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from './route';
import { NextRequest } from 'next/server';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { NotFoundError, ValidationError, ConflictError } from '@/lib/backend/errors';

// Mock the marketplace service
vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    cancelListing: vi.fn(),
  },
}));

describe('DELETE /api/marketplace/listings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cancel a listing successfully', async () => {
    vi.mocked(marketplaceService.cancelListing).mockResolvedValue(undefined);

    const listingId = 'listing_1_1234567890';
    const sellerAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}?sellerAddress=${sellerAddress}`,
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.listingId).toBe(listingId);
    expect(data.data.cancelled).toBe(true);
    expect(data.data.message).toBe('Listing cancelled successfully');
    expect(marketplaceService.cancelListing).toHaveBeenCalledWith(
      listingId,
      sellerAddress
    );
  });

  it('should return 400 when listing ID is missing', async () => {
    const sellerAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/?sellerAddress=${sellerAddress}`,
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toBe('Listing ID is required');
  });

  it('should return 400 when sellerAddress query parameter is missing', async () => {
    const listingId = 'listing_1_1234567890';

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}`,
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toBe('sellerAddress query parameter is required');
  });

  it('should return 404 when listing does not exist', async () => {
    const notFoundError = new NotFoundError('Listing');

    vi.mocked(marketplaceService.cancelListing).mockRejectedValue(notFoundError);

    const listingId = 'nonexistent_listing';
    const sellerAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}?sellerAddress=${sellerAddress}`,
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('should return 400 when seller address does not match', async () => {
    const validationError = new ValidationError('Only the seller can cancel this listing.');

    vi.mocked(marketplaceService.cancelListing).mockRejectedValue(validationError);

    const listingId = 'listing_1_1234567890';
    const wrongSellerAddress = 'GWRONGSELLERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}?sellerAddress=${wrongSellerAddress}`,
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 409 when listing is not active', async () => {
    const conflictError = new ConflictError('Only active listings can be cancelled.');

    vi.mocked(marketplaceService.cancelListing).mockRejectedValue(conflictError);

    const listingId = 'listing_already_cancelled';
    const sellerAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}?sellerAddress=${sellerAddress}`,
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
  });
});
