export type ListingStatus = 'Active' | 'Sold' | 'Cancelled';

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
