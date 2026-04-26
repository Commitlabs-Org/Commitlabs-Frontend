import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from './route';
import { NextRequest } from 'next/server';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { verifySessionToken } from '@/lib/backend/auth';
import { logListingCancelled, logListingCancellationFailed } from '@/lib/backend/logger';
import { ConflictError } from '@/lib/backend/errors';

// Mock dependencies
vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    cancelListing: vi.fn(),
    getListing: vi.fn(),
  },
}));

vi.mock('@/lib/backend/auth', () => ({
  verifySessionToken: vi.fn(),
}));

vi.mock('@/lib/backend/logger', () => ({
  logListingCancelled: vi.fn(),
  logListingCancellationFailed: vi.fn(),
}));

describe('DELETE /api/marketplace/listings/[id]', () => {
  const listingId = 'listing_1_1234567890';
  const validSellerAddress = 'GSELLERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const otherAddress = 'GOTHERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const validToken = 'session_GSELLERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cancel a listing successfully (200 OK)', async () => {
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: validSellerAddress });
    vi.mocked(marketplaceService.getListing).mockResolvedValue({
      id: listingId,
      sellerAddress: validSellerAddress,
      status: 'Active',
    } as any);
    vi.mocked(marketplaceService.cancelListing).mockResolvedValue(undefined);

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.listingId).toBe(listingId);
    expect(data.data.cancelled).toBe(true);
    expect(marketplaceService.cancelListing).toHaveBeenCalledWith(listingId, validSellerAddress);
    expect(logListingCancelled).toHaveBeenCalledWith({
      listingId,
      sellerAddress: validSellerAddress
    });
    expect(logListingCancellationFailed).not.toHaveBeenCalled();
  });

  it('should return 400 when listing ID is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      }
    );

    const response = await DELETE(request, { params: { id: '' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 when Authorization header is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}`,
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 when session token is invalid', async () => {
    vi.mocked(verifySessionToken).mockReturnValue({ valid: false });

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer invalid_token'
        }
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 404 when listing does not exist', async () => {
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: validSellerAddress });
    vi.mocked(marketplaceService.getListing).mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('should return 403 when authenticated user is not the seller', async () => {
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: otherAddress });
    vi.mocked(marketplaceService.getListing).mockResolvedValue({
      id: listingId,
      sellerAddress: validSellerAddress,
      status: 'Active',
    } as any);

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer session_${otherAddress}_123`
        }
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    
    // Audit failure must be logged
    expect(logListingCancellationFailed).toHaveBeenCalledWith({
      listingId,
      sellerAddress: otherAddress,
      reason: 'Unauthorized seller attempt'
    });
    expect(marketplaceService.cancelListing).not.toHaveBeenCalled();
  });

  it('should return 409 when listing is not active', async () => {
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: validSellerAddress });
    vi.mocked(marketplaceService.getListing).mockResolvedValue({
      id: listingId,
      sellerAddress: validSellerAddress,
      status: 'Cancelled',
    } as any);
    
    // This will be thrown by the service
    const conflictError = new ConflictError('Only active listings can be cancelled.');
    vi.mocked(marketplaceService.cancelListing).mockRejectedValue(conflictError);

    const request = new NextRequest(
      `http://localhost:3000/api/marketplace/listings/${listingId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      }
    );

    const response = await DELETE(request, { params: { id: listingId } });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
  });
});
