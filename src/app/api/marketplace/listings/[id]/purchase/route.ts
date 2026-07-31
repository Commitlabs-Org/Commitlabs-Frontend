import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { isFeatureEnabled } from '@/lib/backend/config';
import { transferOwnership } from '@/lib/backend/services/contracts';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const PurchaseRequestSchema = z.object({
  buyerAddress: z.string().min(1, 'buyerAddress is required'),
});

const MARKETPLACE_PURCHASE_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(MARKETPLACE_PURCHASE_CORS_POLICY);

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
    if (!isFeatureEnabled('marketplace')) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Marketplace feature is disabled.',
            details: { feature: 'marketplace' },
          },
        },
        { status: 404 },
      );
    }

    assertMutationCsrf(req);

    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 'api/marketplace/listings/purchase'))) {
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/marketplace/listings/purchase'),
      );
    }

    const id = params.id;
    if (!id?.trim()) {
      throw new ValidationError('Listing ID is required');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError('Invalid JSON in request body');
    }

    const validation = PurchaseRequestSchema.safeParse(body);
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues);
    }

    const buyerAddress = validation.data.buyerAddress;

    const listing = await marketplaceService.getListing(id);
    if (!listing) {
      throw new NotFoundError('Listing', { listingId: id });
    }

    if (listing.status !== 'Active') {
      throw new ConflictError('Only active listings can be purchased', {
        listingId: id,
        currentStatus: listing.status,
      });
    }

    if (listing.sellerAddress === buyerAddress) {
      throw new ForbiddenError('Cannot purchase your own listing', {
        listingId: id,
      });
    }

    const commitmentId = listing.commitmentId;
    const fromAddress = listing.sellerAddress;
    const toAddress = buyerAddress;

    const transfer = await transferOwnership({ commitmentId, fromAddress, toAddress });

    const purchasedListing = await marketplaceService.completePurchase(id, buyerAddress);

    const responseData = {
      listingId: purchasedListing.id,
      commitmentId,
      buyerAddress,
      sellerAddress: fromAddress,
      txHash: transfer.txHash,
      purchasedAt: purchasedListing.updatedAt,
    };

    return ok(responseData, undefined, 200, correlationId);
  },
  { cors: MARKETPLACE_PURCHASE_CORS_POLICY },
);

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
