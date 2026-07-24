export type ListingStatus = 'Active' | 'Sold' | 'Cancelled';

/** Query parameters accepted by the marketplace listings endpoint. */
export interface MarketplaceQueryParams {
  /** Sort order for listings (e.g. 'price', 'price-desc', 'compliance', 'duration', 'newest') */
  sortBy?: string;
  /** Comma-separated commitment types to include (e.g. 'conservative,balanced') */
  type?: string;
  /** Minimum commitment amount in USD */
  minAmount?: number;
  /** Maximum commitment amount in USD */
  maxAmount?: number;
  /** Minimum compliance score (0–100) */
  minCompliance?: number;
  /** Maximum allowed loss percentage */
  maxLoss?: number;
}

export interface MarketplaceListing {
  id: string;
  commitmentId: string;
  price: string;
  currencyAsset: string;
  sellerAddress: string;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}
// TODO: Update with actual Soroban contract interaction types
export interface CreateListingRequest {
  commitmentId: string;
  price: string;
  currencyAsset: string;
  sellerAddress: string;
}

export interface CreateListingResponse {
  listing: MarketplaceListing;
}

export interface CancelListingResponse {
  listingId: string;
  cancelled: boolean;
  message: string;
}
