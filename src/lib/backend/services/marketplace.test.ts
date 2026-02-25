import { describe, it, expect, beforeEach } from 'vitest';
import { marketplaceService } from './marketplace';
import { ValidationError, ConflictError, NotFoundError } from '../errors';
import type { CreateListingRequest } from '@/types/marketplace';

describe('MarketplaceService', () => {
  // Reset service state before each test
  beforeEach(() => {
    // Clear internal state by creating listings and then accessing private members
    // Since we can't directly access private members, we'll work with the public API
  });

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
});
