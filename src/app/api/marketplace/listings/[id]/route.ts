import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { ValidationError, UnauthorizedError, ForbiddenError, NotFoundError } from '@/lib/backend/errors';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { verifySessionToken } from '@/lib/backend/auth';
import { logListingCancelled, logListingCancellationFailed } from '@/lib/backend/logger';
import type { CancelListingResponse } from '@/types/marketplace';

/**
 * DELETE /api/marketplace/listings/[id]
 *
 * Cancel an existing marketplace listing
 *
 * Headers:
 *   Authorization: Bearer <token> (required)
 */
export const DELETE = withApiHandler(
  async (req: NextRequest, { params }: { params: Record<string, string> }, correlationId: string) => {
    const listingId = params.id;

    if (!listingId) {
      throw new ValidationError('Listing ID is required');
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const session = verifySessionToken(token);

    if (!session.valid || !session.address) {
      throw new UnauthorizedError('Invalid or expired session token');
    }

    const sellerAddress = session.address;

    const listing = await marketplaceService.getListing(listingId);
    if (!listing) {
      throw new NotFoundError('Listing', { listingId });
    }

    if (listing.sellerAddress !== sellerAddress) {
      logListingCancellationFailed({
        listingId,
        sellerAddress,
        reason: 'Unauthorized seller attempt'
      });
      throw new ForbiddenError('Only the seller can cancel this listing.');
    }

    // Cancel listing via service
    await marketplaceService.cancelListing(listingId, sellerAddress);

    logListingCancelled({
      listingId,
      sellerAddress
    });

    const response: CancelListingResponse = {
      listingId,
      cancelled: true,
      message: 'Listing cancelled successfully',
    };

    return ok(response, undefined, 200, correlationId);
  }
);

const _405 = methodNotAllowed(['DELETE']);
export { _405 as GET, _405 as POST, _405 as PUT, _405 as PATCH };
