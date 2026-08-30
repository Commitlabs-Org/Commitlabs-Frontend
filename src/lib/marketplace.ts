import { ConflictError, ForbiddnError, NotFoundError, TooManyRequestsError } from '@/lib/backend/errors';
import { transferOwnership } from '@/lib/backend/services/contracts';
import {
  listMarketplaceListings as backendListMarketplaceListings,
  marketplaceService as backendMarketplaceService,
  type MarketplaceCommitmentType,
  type MarketplacePublicListing,
} from '@/lib/backend/services/marketplace';
import type { CreateListingRequest } from '@/types/marketplace';
import { MARKETPLACE_MAX_CONCURRENT_PURCHASE_LOCKS } from '@/lib/marketplace/constants';
import { emitMarketplaceTelemetry } from '@/lib/marketplace/telemetry';

const purchaseLocks = new Map<string, Promise<unknown>>();

// Bounds for listing pagination.
const MARKETAPLACE_DEFAULT_PAGE_SIZE = 20;
const MARKETPLACE_MAX_PAGE_SIZE = 100;

function normalizePageAndPageSize(page?: number, pageSize?: number): { page: number; pageSize: number } {
  const normalizedPage = Math.max(1, Math.floor(page ?? 1));
  const normalizedPageSize = Math.min(MARKETAPLACE_MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize ?? MARKETAPLACE_DEFAULT_PAGE_SIZE)));
  return { page: normalizedPage, pageSize: normalizedPageSize };
}

async function withPurchaseLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  // Reject duplicate purchase attempts for the same listing to avoid redundant
  // state changes and unbounded queueing.
  if (purchaseLocks.has(key)) {
    throw new ConflictError('A purchase for this listing is already in progress', { listingId: key });
  }

  // Bound the total number of concurrent purchase operations across listings.
  if (purchaseLocks.size >= MARKETAPLACE_MAX_CONCURRENT_PURCHASE_LOCKS) {
    throw new TooManyRequestsError('Too many concurrent purchase requests. Please try again later.');
  }

  const operation = (async () => {
    try {
      return await action();
    } finally {
      purchaseLocks.delete(key);
    }
  })();

  purchaseLocks.set(key, operation);
  return operation;
}

export const marketplaceService = {
  async createListing(request: CreateListingRequest) {
    return backendMarketplaceService.createListing(request);
  },

  async getListing(listingId: string) {
    return backendMarketplaceService.getListing(listingId);
  },

  async completePurchase(listingId: string, buyerAddress: string) {
    return backendMarketplaceService.completePurchase(listingId, buyerAddress);
  },

  async purchaseListing({
    listingId,
    buyerAddress,
    correlationId,
  }: {
    listingId: string;
    buyerAddress: string;
    correlationId?: string;
  }) {
    return withPurchaseLock(listingId, async () => {
      const startedAt = Date.now();
      let recovered = false;

      try {
        const listing = await backendMarketplaceService.getListing(listingId);
        if (!listing) {
          throw new NotFoundError('Listing', { listingId });
        }
        if (listing.status !== 'Active') {
          throw new ConflictError('Only active listings can be purchased', {
            listingId,
            currentStatus: listing.status,
          });
        }
        if (listing.sellerAddress === buyerAddress) {
          throw new ForbiddenError('Cannot purchase your own listing', { listingId });
        }

        const transfer = await transferOwnership({
          commitmentId: listing.commitmentId,
          fromAddress: listing.sellerAddress,
          toAddress: buyerAddress,
        });

        let purchasedListing: MarketplacePublicListing | null;
        try {
          purchasedListing = await backendMarketplaceService.completePurchase(listingId, buyerAddress);
        } catch (error) {
          // If the purchase was actually committed but the response was lost,
          // recover by refreshing the listing state.
          const refreshed = await backendMarketplaceService.getListing(listingId);
          if (refreshed && refreshed.sellerAddress === buyerAddress && refreshed.status !== 'Active') {
            purchasedListing = refreshed;
            recovered = true;
          } else {
            throw error;
          }
        }

        emitMarketplaceTelemetry({
          event: 'marketplace.purchase.succeeded',
          correlationId,
          latencyMs: Date.now() - startedAt,
          details: {
            listingId,
            recovered,
            status: purchasedListing?.status,
          },
        });

        return {
          listing: purchasedListing!,
          transfer,
          commitmentId: listing.commitmentId,
          sellerAddress: listing.sellerAddress,
        };
      } catch (error) {
        const err = error as { code?: string; status?: number };
        emitMarketplaceTelemetry({
          event: 'marketplace.purchase.failed',
          correlationId,
          errorCode: err.code,
          statusCode: err.status ?? 500,
          latencyMs: Date.now() - startedAt,
          details: { listingId, recovered },
        });
        throw error;
      }
    });
  },
};

export async function listMarketplaceListings(
  filters: {
    type?: MarketplaceCommitmentType | undefined;
    minCompliance?: number;
    maxLoss?: number;
    minAmount?: number;
    maxAmount?: number;
    sortBy?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const { page, pageSize, ...rest } = filters;
  const normalized = normalizePageAndPageSize(page, pageSize);
  return backendListMarketplaceListings({
    ...rest,
    page: normalized.page,
    pageSize: normalized.pageSize,
  });
}
