import { describe, it, expect } from 'vitest';
import {
  FEATURED_MARKETPLACE_CONFIG,
  marketplaceService,
  selectFeaturedMarketplaceListings,
  type MarketplacePublicListing,
} from './marketplace';
import { ValidationError, ConflictError, NotFoundError } from '../errors';
import type { CreateListingRequest } from '@/types/marketplace';

describe('MarketplaceService', () => {

  describe('createListing', () => {
    it('should create a valid listing', async () => {
      const request: CreateListingRequest = {
        commitmentId: 'commitment_123',
        price: '1000.50',
        currencyAsset: 'USDC',
        sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      };

      const listing = await marketplaceService.createListing(request);

      expect(listing).toBeDefined();
      expect(listing.id).toBeTruthy();
      expect(listing.commitmentId).toBe(request.commitmentId);
      expect(listing.price).toBe(request.price);
      expect(listing.currencyAsset).toBe(request.currencyAsset);
      expect(listing.sellerAddress).toBe(request.sellerAddress);
      expect(listing.status).toBe('Active');
      expect(listing.createdAt).toBeTruthy();
      expect(listing.updatedAt).toBeTruthy();
    });

    it('should throw ValidationError when commitmentId is missing', async () => {
      const request = {
        price: '1000.50',
        currencyAsset: 'USDC',
        sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      } as CreateListingRequest;

      await expect(marketplaceService.createListing(request)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when price is missing', async () => {
      const request = {
        commitmentId: 'commitment_123',
        currencyAsset: 'USDC',
        sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      } as CreateListingRequest;

      await expect(marketplaceService.createListing(request)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when price is not a positive number', async () => {
      const request: CreateListingRequest = {
        commitmentId: 'commitment_123',
        price: '-100',
        currencyAsset: 'USDC',
        sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      };

      await expect(marketplaceService.createListing(request)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when price is zero', async () => {
      const request: CreateListingRequest = {
        commitmentId: 'commitment_123',
        price: '0',
        currencyAsset: 'USDC',
        sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      };

      await expect(marketplaceService.createListing(request)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when price is not a valid number', async () => {
      const request: CreateListingRequest = {
        commitmentId: 'commitment_123',
        price: 'invalid',
        currencyAsset: 'USDC',
        sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      };

      await expect(marketplaceService.createListing(request)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when currencyAsset is missing', async () => {
      const request = {
        commitmentId: 'commitment_123',
        price: '1000.50',
        sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      } as CreateListingRequest;

      await expect(marketplaceService.createListing(request)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when sellerAddress is missing', async () => {
      const request = {
        commitmentId: 'commitment_123',
        price: '1000.50',
        currencyAsset: 'USDC',
      } as CreateListingRequest;

      await expect(marketplaceService.createListing(request)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ConflictError when commitment is already listed', async () => {
      const request: CreateListingRequest = {
        commitmentId: 'commitment_duplicate',
        price: '1000.50',
        currencyAsset: 'USDC',
        sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      };

      // Create first listing
      await marketplaceService.createListing(request);

      // Try to create duplicate listing
      await expect(marketplaceService.createListing(request)).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe('cancelListing', () => {
    it('should cancel an active listing', async () => {
      const request: CreateListingRequest = {
        commitmentId: 'commitment_cancel_test',
        price: '500.00',
        currencyAsset: 'XLM',
        sellerAddress: 'GSELLERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      };

      const listing = await marketplaceService.createListing(request);

      await expect(
        marketplaceService.cancelListing(listing.id, request.sellerAddress)
      ).resolves.not.toThrow();

      // Verify listing is cancelled
      const cancelledListing = await marketplaceService.getListing(listing.id);
      expect(cancelledListing?.status).toBe('Cancelled');
    });

    it('should throw NotFoundError when listing does not exist', async () => {
      await expect(
        marketplaceService.cancelListing('nonexistent_listing', 'GXXXXXXX')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when seller address does not match', async () => {
      const request: CreateListingRequest = {
        commitmentId: 'commitment_wrong_seller',
        price: '750.00',
        currencyAsset: 'USDC',
        sellerAddress: 'GSELLERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      };

      const listing = await marketplaceService.createListing(request);

      await expect(
        marketplaceService.cancelListing(listing.id, 'GWRONGSELLER')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when trying to cancel a non-active listing', async () => {
      const request: CreateListingRequest = {
        commitmentId: 'commitment_already_cancelled',
        price: '300.00',
        currencyAsset: 'USDC',
        sellerAddress: 'GSELLERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      };

      const listing = await marketplaceService.createListing(request);

      // Cancel once
      await marketplaceService.cancelListing(listing.id, request.sellerAddress);

      // Try to cancel again
      await expect(
        marketplaceService.cancelListing(listing.id, request.sellerAddress)
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getListing', () => {
    it('should return a listing by ID', async () => {
      const request: CreateListingRequest = {
        commitmentId: 'commitment_get_test',
        price: '1500.00',
        currencyAsset: 'USDC',
        sellerAddress: 'GSELLERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      };

      const createdListing = await marketplaceService.createListing(request);
      const retrievedListing = await marketplaceService.getListing(createdListing.id);

      expect(retrievedListing).toBeDefined();
      expect(retrievedListing?.id).toBe(createdListing.id);
      expect(retrievedListing?.commitmentId).toBe(request.commitmentId);
    });

    it('should return null when listing does not exist', async () => {
      const listing = await marketplaceService.getListing('nonexistent_id');
      expect(listing).toBeNull();
    });
  });

  describe('selectFeaturedMarketplaceListings', () => {
    const sampleListings: MarketplacePublicListing[] = [
      {
        listingId: 'LST-010',
        commitmentId: 'CMT-010',
        type: 'Balanced',
        amount: 90000,
        remainingDays: 30,
        maxLoss: 8,
        currentYield: 11.1,
        complianceScore: 90,
        price: 91000,
      },
      {
        listingId: 'LST-002',
        commitmentId: 'CMT-002',
        type: 'Safe',
        amount: 80000,
        remainingDays: 20,
        maxLoss: 2,
        currentYield: 5.5,
        complianceScore: 95,
        price: 83000,
      },
      {
        listingId: 'LST-001',
        commitmentId: 'CMT-001',
        type: 'Safe',
        amount: 70000,
        remainingDays: 18,
        maxLoss: 2,
        currentYield: 5.5,
        complianceScore: 95,
        price: 83000,
      },
      {
        listingId: 'LST-011',
        commitmentId: 'CMT-011',
        type: 'Aggressive',
        amount: 120000,
        remainingDays: 35,
        maxLoss: 12,
        currentYield: 15.2,
        complianceScore: 93,
        price: 124000,
      },
      {
        listingId: 'LST-012',
        commitmentId: 'CMT-012',
        type: 'Balanced',
        amount: 110000,
        remainingDays: 28,
        maxLoss: 8,
        currentYield: 10.4,
        complianceScore: 84,
        price: 112000,
      },
    ];

    it('applies the featured criteria before returning listings', () => {
      const featured = selectFeaturedMarketplaceListings(sampleListings);

      expect(featured).toHaveLength(3);
      expect(featured.every((listing) => listing.complianceScore >= FEATURED_MARKETPLACE_CONFIG.minComplianceScore)).toBe(true);
      expect(featured.every((listing) => listing.maxLoss <= FEATURED_MARKETPLACE_CONFIG.maxLoss)).toBe(true);
      expect(featured.map((listing) => listing.listingId)).toEqual([
        'LST-001',
        'LST-002',
        'LST-010',
      ]);
    });

    it('returns a deterministic order for identical inputs', () => {
      const first = selectFeaturedMarketplaceListings(sampleListings);
      const second = selectFeaturedMarketplaceListings(sampleListings);

      expect(first).toEqual(second);
    });

    it('returns an empty array when no listings satisfy the featured criteria', () => {
      const featured = selectFeaturedMarketplaceListings([
        {
          listingId: 'LST-099',
          commitmentId: 'CMT-099',
          type: 'Aggressive',
          amount: 150000,
          remainingDays: 60,
          maxLoss: 25,
          currentYield: 19.5,
          complianceScore: 70,
          price: 160000,
        },
      ]);

      expect(featured).toEqual([]);
    });
  });
});
