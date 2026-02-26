import { logger } from '../logger';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import type {
  MarketplaceListing,
  CreateListingRequest,
} from '@/lib/types/domain';

/**
 * MarketplaceService
 *
 * Abstracts marketplace operations for Commitment NFT listings.
 * Currently uses in-memory stub data. Will be replaced with actual
 * on-chain contract calls in the future.
 */
class MarketplaceService {
  // In-memory stub storage (replace with contract calls)
  private listings: Map<string, MarketplaceListing> = new Map();
  private listingCounter = 0;

  /**
   * Create a new marketplace listing for a Commitment NFT
   */
  async createListing(request: CreateListingRequest): Promise<MarketplaceListing> {
    logger.info('[MarketplaceService] Creating listing', { request });

    // Validate request
    this.validateCreateListingRequest(request);

    // Check if commitment is already listed
    const existingListing = Array.from(this.listings.values()).find(
      (listing) =>
        listing.commitmentId === request.commitmentId && listing.status === 'Active'
    );

    if (existingListing) {
      throw new ConflictError(
        'Commitment is already listed on the marketplace.',
        { commitmentId: request.commitmentId, existingListingId: existingListing.id }
      );
    }

    // Generate listing ID
    this.listingCounter++;
    const listingId = `listing_${this.listingCounter}_${Date.now()}`;

    // Create listing object
    const listing: MarketplaceListing = {
      id: listingId,
      commitmentId: request.commitmentId,
      price: request.price,
      currencyAsset: request.currencyAsset,
      sellerAddress: request.sellerAddress,
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store listing (stub - replace with contract call)
    this.listings.set(listingId, listing);

    logger.info('[MarketplaceService] Listing created', { listingId });

    // TODO: Replace with actual contract interaction
    // await marketplaceContract.createListing({
    //   commitmentId: request.commitmentId,
    //   price: request.price,
    //   currencyAsset: request.currencyAsset,
    //   seller: request.sellerAddress,
    // });

    return listing;
  }

  /**
   * Cancel an existing marketplace listing
   */
  async cancelListing(listingId: string, sellerAddress: string): Promise<void> {
    logger.info('[MarketplaceService] Cancelling listing', { listingId, sellerAddress });

    // Retrieve listing
    const listing = this.listings.get(listingId);

    if (!listing) {
      throw new NotFoundError('Listing', { listingId });
    }

    // Verify seller
    if (listing.sellerAddress !== sellerAddress) {
      throw new ValidationError('Only the seller can cancel this listing.', {
        listingId,
        expectedSeller: listing.sellerAddress,
        providedSeller: sellerAddress,
      });
    }

    // Check if listing is active
    if (listing.status !== 'Active') {
      throw new ConflictError('Only active listings can be cancelled.', {
        listingId,
        currentStatus: listing.status,
      });
    }

    // Update listing status
    listing.status = 'Cancelled';
    listing.updatedAt = new Date().toISOString();
    this.listings.set(listingId, listing);

    logger.info('[MarketplaceService] Listing cancelled', { listingId });

    // TODO: Replace with actual contract interaction
    // await marketplaceContract.cancelListing(listingId, sellerAddress);
  }

  /**
   * Get a listing by ID (helper method for future use)
   */
  async getListing(listingId: string): Promise<MarketplaceListing | null> {
    return this.listings.get(listingId) || null;
  }

  /**
   * Validate create listing request
   */
  private validateCreateListingRequest(request: CreateListingRequest): void {
    const errors: string[] = [];

    if (!request.commitmentId || typeof request.commitmentId !== 'string') {
      errors.push('commitmentId is required and must be a string');
    }

    if (!request.price || typeof request.price !== 'string') {
      errors.push('price is required and must be a string');
    } else {
      // Validate price is a positive number
      const priceNum = parseFloat(request.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        errors.push('price must be a positive number');
      }
    }

    if (!request.currencyAsset || typeof request.currencyAsset !== 'string') {
      errors.push('currencyAsset is required and must be a string');
    }

    if (!request.sellerAddress || typeof request.sellerAddress !== 'string') {
      errors.push('sellerAddress is required and must be a string');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid listing request', { errors });
    }
  }
}

// Export singleton instance
export const marketplaceService = new MarketplaceService();
