import { NextRequest, NextResponse } from 'next/server';
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
import { idempotencyService } from '@/lib/backend/idempotency';
import { isFeatureEnabled } from '@/lib/backend/config';
import {
  assertWalletMatchesSession,
  IdempotencyKeySchema,
  MarketplacePurchaseBoundarySchema,
  type MarketplacePurchaseResponse,
  parseMarketplaceListingId,
  validateMarketplaceListingSnapshot,
} from '@/lib/backend/marketplaceBoundary';
import { transferOwnership } from '@/lib/backend/services/contracts';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { verifyAuth } from '@/lib/backend/requireAuth';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const MARKETPLACE_PURCHASE_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(MARKETPLACE_PURCHASE_CORS_POLICY);

function getScopedIdempotencyKey(
  req: NextRequest,
  listingId: string,
  buyerAddress: string,
): string | null {
  const raw = req.headers.get('idempotency-key');
  if (!raw) return null;

  const result = IdempotencyKeySchema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError('Invalid Idempotency-Key header', result.error.issues);
  }

  return `marketplace:purchase:${buyerAddress}:${listingId}:${result.data}`;
}

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

    const auth = verifyAuth(req);

    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 'api/marketplace/listings/purchase'))) {
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/marketplace/listings/purchase'),
      );
    }

    const id = parseMarketplaceListingId(params.id);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError('Invalid JSON in request body');
    }

    const validation = MarketplacePurchaseBoundarySchema.safeParse(body);
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues);
    }

    const buyerAddress = validation.data.buyerAddress;
    assertWalletMatchesSession(auth.address, buyerAddress, 'buyerAddress');

    const idempotencyKey = getScopedIdempotencyKey(req, id, buyerAddress);
    if (idempotencyKey) {
      const record =
        await idempotencyService.getRecord<MarketplacePurchaseResponse>(idempotencyKey);
      if (record?.status === 'COMPLETED' && record.response) {
        return ok(record.response, { fromCache: true }, record.statusCode ?? 200, correlationId);
      }
      if (record?.status === 'STARTED') {
        throw new ConflictError('A purchase with this Idempotency-Key is already processing.', {
          listingId: id,
        });
      }
      const started = await idempotencyService.start(idempotencyKey);
      if (!started) {
        throw new ConflictError('A purchase with this Idempotency-Key is already processing.', {
          listingId: id,
        });
      }
    }

    try {
      const rawListing = await marketplaceService.getListing(id);
      if (!rawListing) {
        throw new NotFoundError('Listing', { listingId: id });
      }

      const listing = validateMarketplaceListingSnapshot(rawListing, id);

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

      const purchasedListing = validateMarketplaceListingSnapshot(
        await marketplaceService.completePurchase(id, buyerAddress),
        id,
      );

      if (purchasedListing.status !== 'Sold') {
        throw new ValidationError('Marketplace purchase response did not mark the listing sold.', {
          listingId: id,
          currentStatus: purchasedListing.status,
        });
      }

      const responseData: MarketplacePurchaseResponse = {
        listingId: purchasedListing.id,
        commitmentId,
        buyerAddress,
        sellerAddress: fromAddress,
        purchasedAt: purchasedListing.updatedAt,
        ...(transfer.txHash ? { txHash: transfer.txHash } : {}),
      };

      if (idempotencyKey) {
        await idempotencyService.complete(idempotencyKey, responseData, 200);
      }

      return ok(responseData, undefined, 200, correlationId);
    } catch (error) {
      if (idempotencyKey) {
        await idempotencyService.fail(idempotencyKey);
      }
      throw error;
    }
  },
  { cors: MARKETPLACE_PURCHASE_CORS_POLICY },
);

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
