import { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/backend/errors';
import { verifySessionToken } from '@/lib/backend/auth';
import { logListingCancelled, logListingCancellationFailed } from '@/lib/backend/logger';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import type { CancelListingResponse } from '@/types/marketplace';

const MARKETPLACE_LISTING_DETAIL_CORS_POLICY = {
  DELETE: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(MARKETPLACE_LISTING_DETAIL_CORS_POLICY);

export const DELETE = withApiHandler(async (req: NextRequest, { params }, correlationId) => {
  assertMutationCsrf(req);

  const listingId = params.id;
  if (!listingId) {
    throw new ValidationError('Listing ID is required');
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);
  const session = verifySessionToken(token);
  if (!session.valid || !session.address) {
    throw new UnauthorizedError('Invalid or expired session token');
  }

  const listing = await marketplaceService.getListing(listingId);
  if (!listing) {
    throw new NotFoundError('Listing', { listingId });
  }
  if (listing.sellerAddress !== session.address) {
    logListingCancellationFailed({
      listingId,
      sellerAddress: session.address,
      reason: 'Unauthorized seller attempt',
    });
    throw new ForbiddenError('Only the seller can cancel this listing.');
  }

  await marketplaceService.cancelListing(listingId, session.address);
  logListingCancelled({ listingId, sellerAddress: session.address });

  const response: CancelListingResponse = {
    listingId,
    cancelled: true,
    message: 'Listing cancelled successfully',
  };

  return ok(response, undefined, 200, correlationId);
}, { cors: MARKETPLACE_LISTING_DETAIL_CORS_POLICY });

const _405 = methodNotAllowed(['DELETE']);
export { _405 as GET, _405 as POST, _405 as PUT, _405 as PATCH };
