import { logInfo } from '../logger';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import type {
  MarketplaceListing,
  CreateListingRequest,
} from '@/lib/types/domain';
} from '@/types/marketplace';

export type MarketplaceCommitmentType = 'Safe' | 'Balanced' | 'Aggressive';

export interface MarketplacePublicListing {
  listingId: string;
  commitmentId: string;
  type: MarketplaceCommitmentType;
  amount: number;
  remainingDays: number;
  maxLoss: number;
  currentYield: number;
  complianceScore: number;
  price: number;
}

export interface MarketplaceListingsQuery {
  type?: MarketplaceCommitmentType;
  minCompliance?: number;
  maxLoss?: number;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
}

const MOCK_LISTINGS: MarketplacePublicListing[] = [
  {
    listingId: 'LST-001',
    commitmentId: 'CMT-001',
    type: 'Safe',
    amount: 50000,
    remainingDays: 25,
    maxLoss: 2,
    currentYield: 5.2,
    complianceScore: 95,
    price: 52000,
  },
  {
    listingId: 'LST-002',
    commitmentId: 'CMT-002',
    type: 'Balanced',
    amount: 100000,
    remainingDays: 45,
    maxLoss: 8,
    currentYield: 12.5,
    complianceScore: 88,
    price: 105000,
  },
  {
    listingId: 'LST-003',
    commitmentId: 'CMT-003',
    type: 'Aggressive',
    amount: 250000,
    remainingDays: 80,
    maxLoss: 100,
    currentYield: 18.7,
    complianceScore: 76,
    price: 262000,
  },
  {
    listingId: 'LST-004',
    commitmentId: 'CMT-004',
    type: 'Safe',
    amount: 75000,
    remainingDays: 15,
    maxLoss: 2,
    currentYield: 4.8,
    complianceScore: 92,
    price: 76500,
  },
  {
    listingId: 'LST-005',
    commitmentId: 'CMT-005',
    type: 'Balanced',
    amount: 150000,
    remainingDays: 55,
    maxLoss: 8,
    currentYield: 11.3,
    complianceScore: 85,
    price: 155000,
  },
  {
    listingId: 'LST-006',
    commitmentId: 'CMT-006',
    type: 'Aggressive',
    amount: 500000,
    remainingDays: 85,
    maxLoss: 100,
    currentYield: 22.1,
    complianceScore: 72,
    price: 525000,
  },
];

const SORT_CONFIG = {
  price: { key: 'price', order: 'desc' },
  amount: { key: 'amount', order: 'desc' },
  complianceScore: { key: 'complianceScore', order: 'desc' },
  remainingDays: { key: 'remainingDays', order: 'asc' },
  maxLoss: { key: 'maxLoss', order: 'asc' },
  currentYield: { key: 'currentYield', order: 'desc' },
} as const satisfies Record<string, { key: keyof MarketplacePublicListing; order: 'asc' | 'desc' }>;

export type MarketplaceSortBy = keyof typeof SORT_CONFIG;

function sortListings(listings: MarketplacePublicListing[], sortBy: MarketplaceSortBy): MarketplacePublicListing[] {
  const { key, order } = SORT_CONFIG[sortBy];

  return [...listings].sort((a, b) => {
    const lhs = a[key] as number;
    const rhs = b[key] as number;
    return order === 'asc' ? lhs - rhs : rhs - lhs;
  });
}

export function isMarketplaceSortBy(value: string): value is MarketplaceSortBy {
  return value in SORT_CONFIG;
}

export function getMarketplaceSortKeys(): MarketplaceSortBy[] {
  return Object.keys(SORT_CONFIG) as MarketplaceSortBy[];
}

export async function listMarketplaceListings(query: MarketplaceListingsQuery): Promise<MarketplacePublicListing[]> {
  let results = MOCK_LISTINGS;

  if (query.type) {
    results = results.filter((listing) => listing.type === query.type);
  }
  if (query.minCompliance !== undefined) {
    const minCompliance = query.minCompliance;
    results = results.filter((listing) => listing.complianceScore >= minCompliance);
  }
  if (query.maxLoss !== undefined) {
    const maxLoss = query.maxLoss;
    results = results.filter((listing) => listing.maxLoss <= maxLoss);
  }
  if (query.minAmount !== undefined) {
    const minAmount = query.minAmount;
    results = results.filter((listing) => listing.amount >= minAmount);
  }
  if (query.maxAmount !== undefined) {
    const maxAmount = query.maxAmount;
    results = results.filter((listing) => listing.amount <= maxAmount);
  }

  const sortBy = query.sortBy && isMarketplaceSortBy(query.sortBy) ? query.sortBy : 'price';

  // TODO(on-chain): Replace mock listings with marketplace contract reads.
  // TODO(attestation): Merge latest attestation engine score per commitment when available.
  return sortListings(results, sortBy);
}

class MarketplaceService {
  private listings: Map<string, MarketplaceListing> = new Map();
  private listingCounter = 0;

  async createListing(request: CreateListingRequest): Promise<MarketplaceListing> {
    logInfo(undefined, '[MarketplaceService] Creating listing', { request });

    this.validateCreateListingRequest(request);

    const existingListing = Array.from(this.listings.values()).find(
      (listing) => listing.commitmentId === request.commitmentId && listing.status === 'Active'
    );

    if (existingListing) {
      throw new ConflictError(
        'Commitment is already listed on the marketplace.',
        { commitmentId: request.commitmentId, existingListingId: existingListing.id }
      );
    }

    this.listingCounter += 1;
    const listingId = `listing_${this.listingCounter}_${Date.now()}`;

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

    this.listings.set(listingId, listing);

    logInfo(undefined, '[MarketplaceService] Listing created', { listingId });

    // TODO(on-chain): Replace in-memory listing creation with marketplace contract interaction.
    return listing;
  }

  async cancelListing(listingId: string, sellerAddress: string): Promise<void> {
    logInfo(undefined, '[MarketplaceService] Cancelling listing', { listingId, sellerAddress });

    const listing = this.listings.get(listingId);

    if (!listing) {
      throw new NotFoundError('Listing', { listingId });
    }

    if (listing.sellerAddress !== sellerAddress) {
      throw new ValidationError('Only the seller can cancel this listing.', {
        listingId,
        expectedSeller: listing.sellerAddress,
        providedSeller: sellerAddress,
      });
    }

    if (listing.status !== 'Active') {
      throw new ConflictError('Only active listings can be cancelled.', {
        listingId,
        currentStatus: listing.status,
      });
    }

    listing.status = 'Cancelled';
    listing.updatedAt = new Date().toISOString();
    this.listings.set(listingId, listing);

    logInfo(undefined, '[MarketplaceService] Listing cancelled', { listingId });

    // TODO(on-chain): Replace in-memory cancel with marketplace contract interaction.
  }

  async getListing(listingId: string): Promise<MarketplaceListing | null> {
    return this.listings.get(listingId) ?? null;
  }

  private validateCreateListingRequest(request: CreateListingRequest): void {
    const errors: string[] = [];

    if (!request.commitmentId || typeof request.commitmentId !== 'string') {
      errors.push('commitmentId is required and must be a string');
    }

    if (!request.price || typeof request.price !== 'string') {
      errors.push('price is required and must be a string');
    } else {
      const priceNum = Number.parseFloat(request.price);
      if (Number.isNaN(priceNum) || priceNum <= 0) {
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

export const marketplaceService = new MarketplaceService();
