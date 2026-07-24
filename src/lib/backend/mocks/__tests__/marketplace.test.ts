import { describe, it, expect, beforeEach } from 'vitest';
import { listMarketplace, buyCommitment, Listing } from '../marketplace';

describe('marketplace mock data generator', () => {
    describe('Listing interface shape conformance', () => {
        it('should return an array of listings', async () => {
            const listings = await listMarketplace();
            expect(Array.isArray(listings)).toBe(true);
        });

        it('should return a non-empty list', async () => {
            const listings = await listMarketplace();
            expect(listings.length).toBeGreaterThan(0);
        });

        it('each listing should have all required fields', async () => {
            const listings = await listMarketplace();
            for (const listing of listings) {
                expect(listing).toHaveProperty('id');
                expect(listing).toHaveProperty('type');
                expect(listing).toHaveProperty('score');
                expect(listing).toHaveProperty('amount');
                expect(listing).toHaveProperty('duration');
                expect(listing).toHaveProperty('yield');
                expect(listing).toHaveProperty('maxLoss');
                expect(listing).toHaveProperty('owner');
                expect(listing).toHaveProperty('price');
                expect(listing).toHaveProperty('forSale');
            }
        });

        it('each listing id should be a string', async () => {
            const listings = await listMarketplace();
            for (const listing of listings) {
                expect(typeof listing.id).toBe('string');
            }
        });

        it('each listing type should be Safe, Balanced, or Aggressive', async () => {
            const listings = await listMarketplace();
            const validTypes: Listing['type'][] = ['Safe', 'Balanced', 'Aggressive'];
            for (const listing of listings) {
                expect(validTypes).toContain(listing.type);
            }
        });

        it('each listing score should be a number between 0 and 100', async () => {
            const listings = await listMarketplace();
            for (const listing of listings) {
                expect(typeof listing.score).toBe('number');
                expect(listing.score).toBeGreaterThanOrEqual(0);
                expect(listing.score).toBeLessThanOrEqual(100);
            }
        });

        it('each listing forSale should be a boolean', async () => {
            const listings = await listMarketplace();
            for (const listing of listings) {
                expect(typeof listing.forSale).toBe('boolean');
            }
        });
    });

    describe('id uniqueness', () => {
        it('all listing ids should be unique', async () => {
            const listings = await listMarketplace();
            const ids = listings.map((l) => l.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });
    });

    describe('determinism and stable ordering', () => {
        it('should return the same listings on multiple calls', async () => {
            const first = await listMarketplace();
            const second = await listMarketplace();
            expect(first.length).toBe(second.length);
            for (let i = 0; i < first.length; i++) {
                expect(first[i].id).toBe(second[i].id);
                expect(first[i].type).toBe(second[i].type);
                expect(first[i].score).toBe(second[i].score);
            }
        });

        it('should return listings in a stable order', async () => {
            const first = await listMarketplace();
            const second = await listMarketplace();
            const firstIds = first.map((l) => l.id);
            const secondIds = second.map((l) => l.id);
            expect(firstIds).toEqual(secondIds);
        });
    });

    describe('buyCommitment', () => {
        beforeEach(async () => {
            // Reset state by re-importing (workaround: restore forSale state via direct access)
            // We'll restore state after each test that mutates
        });

        it('should return true when buying a listing that is for sale', async () => {
            const listings = await listMarketplace();
            const forSaleListing = listings.find((l) => l.forSale);
            if (!forSaleListing) return;
            const buyer = '0x1111111111111111111111111111111111111111';
            const result = await buyCommitment(forSaleListing.id, buyer);
            expect(result).toBe(true);
        });

        it('should return false for a non-existent listing id', async () => {
            const result = await buyCommitment('nonexistent-id', '0xabc');
            expect(result).toBe(false);
        });

        it('should update the owner address after a successful buy', async () => {
            const listings = await listMarketplace();
            // Find a listing still for sale (state may have changed from prior test)
            const forSaleListing = listings.find((l) => l.forSale);
            if (!forSaleListing) return;
            const buyer = '0x2222222222222222222222222222222222222222';
            await buyCommitment(forSaleListing.id, buyer);
            expect(forSaleListing.owner).toBe(buyer);
            expect(forSaleListing.forSale).toBe(false);
        });

        it('should return false when buying a listing that is not for sale', async () => {
            const listings = await listMarketplace();
            const notForSale = listings.find((l) => !l.forSale);
            if (!notForSale) return;
            const result = await buyCommitment(notForSale.id, '0xbuyer');
            expect(result).toBe(false);
        });
    });
});
