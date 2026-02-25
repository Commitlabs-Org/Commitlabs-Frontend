import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { ValidationError } from '@/lib/backend/errors';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import type { CancelListingResponse } from '@/types/marketplace';

/**
 * DELETE /api/marketplace/listings/[id]
 *
 * Cancel an existing marketplace listing
 *
 * Query parameters:
 *   sellerAddress: string (required) - Address of the seller cancelling the listing
 */
export const DELETE = withApiHandler(
  async (req: NextRequest, { params }: { params: Record<string, string> }) => {
    const listingId = params.id;

    if (!listingId) {
      throw new ValidationError('Listing ID is required');
    }

    // Get sellerAddress from query params
    const { searchParams } = new URL(req.url);
    const sellerAddress = searchParams.get('sellerAddress');

    if (!sellerAddress) {
      throw new ValidationError('sellerAddress query parameter is required');
    }

    // Cancel listing via service
    await marketplaceService.cancelListing(listingId, sellerAddress);

    const response: CancelListingResponse = {
      listingId,
      cancelled: true,
      message: 'Listing cancelled successfully',
    };

    return ok(response);
  }
);
