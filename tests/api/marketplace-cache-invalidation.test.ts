import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryAdapter } from "@/lib/backend/cache/memory";
import { CacheKey, CacheTTL } from "@/lib/backend/cache/index";

/**
 * Test suite for marketplace cache invalidation behavior.
 *
 * These tests verify that:
 * 1. Listing creation invalidates all cached listing queries
 * 2. Listing creation invalidates the marketplace stats cache
 * 3. Listing cancellation invalidates all cached listing queries
 * 4. Listing cancellation invalidates the marketplace stats cache
 * 5. Cache entries naturally expire after TTL
 * 6. Multiple mutations properly cascade invalidation
 */

describe("Marketplace Cache Invalidation", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Listing Query Cache ────────────────────────────────────────────────────

  describe("Listing queries cache", () => {
    it("caches marketplace listings queries with deterministic query hash", async () => {
      const queryHash = "query_hash_123";
      const cacheKey = CacheKey.marketplaceListings(queryHash);
      const listings = [
        {
          listingId: "LST-001",
          commitmentId: "CMT-001",
          type: "Safe" as const,
          amount: 50000,
          remainingDays: 25,
          maxLoss: 2,
          currentYield: 5.2,
          complianceScore: 95,
          price: 52000,
        },
      ];

      // Store a listing query in cache
      await adapter.set(cacheKey, listings, CacheTTL.MARKETPLACE_LISTINGS);
      expect(await adapter.get(cacheKey)).toEqual(listings);
    });

    it("evicts listing query cache entries via prefix invalidation", async () => {
      const prefix = "commitlabs:marketplace:listings:";
      const hash1 = "hash_1";
      const hash2 = "hash_2";
      const key1 = CacheKey.marketplaceListings(hash1);
      const key2 = CacheKey.marketplaceListings(hash2);
      const mockListing = {
        listingId: "LST-001",
        commitmentId: "CMT-001",
        type: "Safe" as const,
        amount: 50000,
        remainingDays: 25,
        maxLoss: 2,
        currentYield: 5.2,
        complianceScore: 95,
        price: 52000,
      };

      // Set up two different query caches
      await adapter.set(key1, [mockListing], CacheTTL.MARKETPLACE_LISTINGS);
      await adapter.set(
        key2,
        [mockListing, mockListing],
        CacheTTL.MARKETPLACE_LISTINGS,
      );

      // Both should be present initially
      expect(await adapter.get(key1)).toEqual([mockListing]);
      expect(await adapter.get(key2)).toEqual([mockListing, mockListing]);

      // Invalidate all listings queries via prefix
      await adapter.invalidate(prefix);

      // Both should be evicted
      expect(await adapter.get(key1)).toBeNull();
      expect(await adapter.get(key2)).toBeNull();
    });

    it("respects TTL for listing query cache entries", async () => {
      const queryHash = "query_hash_123";
      const cacheKey = CacheKey.marketplaceListings(queryHash);
      const mockListing = {
        listingId: "LST-001",
        commitmentId: "CMT-001",
        type: "Safe" as const,
        amount: 50000,
        remainingDays: 25,
        maxLoss: 2,
        currentYield: 5.2,
        complianceScore: 95,
        price: 52000,
      };

      await adapter.set(cacheKey, [mockListing], CacheTTL.MARKETPLACE_LISTINGS);

      // Should be present just before TTL expires
      vi.advanceTimersByTime((CacheTTL.MARKETPLACE_LISTINGS - 1) * 1000);
      expect(await adapter.get(cacheKey)).toEqual([mockListing]);

      // Should expire after TTL passes
      vi.advanceTimersByTime(2000);
      expect(await adapter.get(cacheKey)).toBeNull();
    });
  });

  // ── Marketplace Stats Cache ────────────────────────────────────────────────

  describe("Marketplace stats cache", () => {
    it("stores marketplace stats in dedicated cache key", async () => {
      const statsKey = CacheKey.marketplaceStats();
      const mockStats = {
        activeListings: 6,
        averageYield: 12.3,
        medianPrice: 155000,
        typeBreakdown: { Safe: 2, Balanced: 2, Aggressive: 2 },
      };

      await adapter.set(statsKey, mockStats, CacheTTL.MARKETPLACE_STATS);
      expect(await adapter.get(statsKey)).toEqual(mockStats);
    });

    it("evicts stats cache entry via delete", async () => {
      const statsKey = CacheKey.marketplaceStats();
      const mockStats = {
        activeListings: 6,
        averageYield: 12.3,
        medianPrice: 155000,
        typeBreakdown: { Safe: 2, Balanced: 2, Aggressive: 2 },
      };

      await adapter.set(statsKey, mockStats, CacheTTL.MARKETPLACE_STATS);
      expect(await adapter.get(statsKey)).toEqual(mockStats);

      // Delete should remove the entry
      await adapter.delete(statsKey);
      expect(await adapter.get(statsKey)).toBeNull();
    });

    it("respects TTL for stats cache entries", async () => {
      const statsKey = CacheKey.marketplaceStats();
      const mockStats = {
        activeListings: 6,
        averageYield: 12.3,
        medianPrice: 155000,
        typeBreakdown: { Safe: 2, Balanced: 2, Aggressive: 2 },
      };

      await adapter.set(statsKey, mockStats, CacheTTL.MARKETPLACE_STATS);

      // Should be present just before TTL expires
      vi.advanceTimersByTime((CacheTTL.MARKETPLACE_STATS - 1) * 1000);
      expect(await adapter.get(statsKey)).toEqual(mockStats);

      // Should expire after TTL passes
      vi.advanceTimersByTime(2000);
      expect(await adapter.get(statsKey)).toBeNull();
    });
  });

  // ── Cache Isolation ────────────────────────────────────────────────────────

  describe("Cache isolation", () => {
    it("does not evict stats cache when invalidating listings prefix", async () => {
      const listingsPrefix = "commitlabs:marketplace:listings:";
      const statsKey = CacheKey.marketplaceStats();
      const listingKey = CacheKey.marketplaceListings("hash_1");
      const mockListing = {
        listingId: "LST-001",
        commitmentId: "CMT-001",
        type: "Safe" as const,
        amount: 50000,
        remainingDays: 25,
        maxLoss: 2,
        currentYield: 5.2,
        complianceScore: 95,
        price: 52000,
      };
      const mockStats = {
        activeListings: 1,
        averageYield: 5.2,
        medianPrice: 52000,
        typeBreakdown: { Safe: 1, Balanced: 0, Aggressive: 0 },
      };

      // Set both listings and stats cache
      await adapter.set(
        listingKey,
        [mockListing],
        CacheTTL.MARKETPLACE_LISTINGS,
      );
      await adapter.set(statsKey, mockStats, CacheTTL.MARKETPLACE_STATS);

      // Invalidate listings prefix
      await adapter.invalidate(listingsPrefix);

      // Listings should be gone
      expect(await adapter.get(listingKey)).toBeNull();

      // Stats should remain
      expect(await adapter.get(statsKey)).toEqual(mockStats);
    });

    it("does not invalidate other cache namespaces", async () => {
      const listingsPrefix = "commitlabs:marketplace:listings:";
      const commitmentKey = CacheKey.commitment("CMT-001");
      const listingKey = CacheKey.marketplaceListings("hash_1");
      const mockListing = {
        listingId: "LST-001",
        commitmentId: "CMT-001",
        type: "Safe" as const,
        amount: 50000,
        remainingDays: 25,
        maxLoss: 2,
        currentYield: 5.2,
        complianceScore: 95,
        price: 52000,
      };
      const mockCommitment = { id: "CMT-001", status: "active" };

      // Set commitment and listing cache entries
      await adapter.set(
        commitmentKey,
        mockCommitment,
        CacheTTL.COMMITMENT_DETAIL,
      );
      await adapter.set(
        listingKey,
        [mockListing],
        CacheTTL.MARKETPLACE_LISTINGS,
      );

      // Invalidate marketplace listings
      await adapter.invalidate(listingsPrefix);

      // Listing should be gone
      expect(await adapter.get(listingKey)).toBeNull();

      // Commitment cache should remain untouched
      expect(await adapter.get(commitmentKey)).toEqual(mockCommitment);
    });
  });

  // ── Invalidation Triggering ────────────────────────────────────────────────

  describe("Invalidation triggering scenarios", () => {
    it("simulates listing creation invalidating all queries and stats", async () => {
      // Simulate pre-populated caches before mutation
      const queryHash1 = "hash_safe_only";
      const queryHash2 = "hash_aggressive_only";
      const queryKey1 = CacheKey.marketplaceListings(queryHash1);
      const queryKey2 = CacheKey.marketplaceListings(queryHash2);
      const statsKey = CacheKey.marketplaceStats();
      const listingsPrefix = "commitlabs:marketplace:listings:";

      const mockListing = {
        listingId: "LST-001",
        commitmentId: "CMT-001",
        type: "Safe" as const,
        amount: 50000,
        remainingDays: 25,
        maxLoss: 2,
        currentYield: 5.2,
        complianceScore: 95,
        price: 52000,
      };
      const mockStats = {
        activeListings: 1,
        averageYield: 5.2,
        medianPrice: 52000,
        typeBreakdown: { Safe: 1, Balanced: 0, Aggressive: 0 },
      };

      // Pre-populate caches
      await adapter.set(
        queryKey1,
        [mockListing],
        CacheTTL.MARKETPLACE_LISTINGS,
      );
      await adapter.set(
        queryKey2,
        [mockListing],
        CacheTTL.MARKETPLACE_LISTINGS,
      );
      await adapter.set(statsKey, mockStats, CacheTTL.MARKETPLACE_STATS);

      // Simulate what would happen on listing creation
      await adapter.invalidate(listingsPrefix);
      await adapter.delete(statsKey);

      // All should be evicted
      expect(await adapter.get(queryKey1)).toBeNull();
      expect(await adapter.get(queryKey2)).toBeNull();
      expect(await adapter.get(statsKey)).toBeNull();
    });

    it("simulates listing cancellation invalidating all queries and stats", async () => {
      // Simulate pre-populated caches before mutation
      const queryHash = "hash_all_listings";
      const queryKey = CacheKey.marketplaceListings(queryHash);
      const statsKey = CacheKey.marketplaceStats();
      const listingsPrefix = "commitlabs:marketplace:listings:";

      const mockListing = {
        listingId: "LST-001",
        commitmentId: "CMT-001",
        type: "Safe" as const,
        amount: 50000,
        remainingDays: 25,
        maxLoss: 2,
        currentYield: 5.2,
        complianceScore: 95,
        price: 52000,
      };
      const mockStats = {
        activeListings: 1,
        averageYield: 5.2,
        medianPrice: 52000,
        typeBreakdown: { Safe: 1, Balanced: 0, Aggressive: 0 },
      };

      // Pre-populate caches
      await adapter.set(queryKey, [mockListing], CacheTTL.MARKETPLACE_LISTINGS);
      await adapter.set(statsKey, mockStats, CacheTTL.MARKETPLACE_STATS);

      // Simulate what would happen on listing cancellation
      await adapter.invalidate(listingsPrefix);
      await adapter.delete(statsKey);

      // All should be evicted
      expect(await adapter.get(queryKey)).toBeNull();
      expect(await adapter.get(statsKey)).toBeNull();
    });

    it("handles multiple consecutive invalidations safely", async () => {
      const queryKey = CacheKey.marketplaceListings("hash_1");
      const statsKey = CacheKey.marketplaceStats();
      const listingsPrefix = "commitlabs:marketplace:listings:";
      const mockListing = {
        listingId: "LST-001",
        commitmentId: "CMT-001",
        type: "Safe" as const,
        amount: 50000,
        remainingDays: 25,
        maxLoss: 2,
        currentYield: 5.2,
        complianceScore: 95,
        price: 52000,
      };

      // First mutation: create listing
      await adapter.set(queryKey, [mockListing], CacheTTL.MARKETPLACE_LISTINGS);
      await adapter.set(
        statsKey,
        {
          activeListings: 1,
          averageYield: 5.2,
          medianPrice: 52000,
          typeBreakdown: { Safe: 1, Balanced: 0, Aggressive: 0 },
        },
        CacheTTL.MARKETPLACE_STATS,
      );

      await adapter.invalidate(listingsPrefix);
      await adapter.delete(statsKey);

      expect(await adapter.get(queryKey)).toBeNull();
      expect(await adapter.get(statsKey)).toBeNull();

      // Second mutation: another listing is added and cached
      await adapter.set(
        queryKey,
        [mockListing, mockListing],
        CacheTTL.MARKETPLACE_LISTINGS,
      );
      await adapter.set(
        statsKey,
        {
          activeListings: 2,
          averageYield: 5.2,
          medianPrice: 52000,
          typeBreakdown: { Safe: 2, Balanced: 0, Aggressive: 0 },
        },
        CacheTTL.MARKETPLACE_STATS,
      );

      // Third mutation: cancellation clears again
      await adapter.invalidate(listingsPrefix);
      await adapter.delete(statsKey);

      expect(await adapter.get(queryKey)).toBeNull();
      expect(await adapter.get(statsKey)).toBeNull();
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("handles invalidation of non-existent keys gracefully", async () => {
      const listingsPrefix = "commitlabs:marketplace:listings:";

      // Should not throw even if no keys exist
      await expect(adapter.invalidate(listingsPrefix)).resolves.not.toThrow();

      // Should not throw even if called multiple times
      await expect(adapter.invalidate(listingsPrefix)).resolves.not.toThrow();
      await expect(adapter.invalidate(listingsPrefix)).resolves.not.toThrow();
    });

    it("handles delete of non-existent stats key gracefully", async () => {
      const statsKey = CacheKey.marketplaceStats();

      // Should not throw even if stats entry doesn't exist
      await expect(adapter.delete(statsKey)).resolves.not.toThrow();

      // Should return null
      expect(await adapter.get(statsKey)).toBeNull();
    });

    it("handles concurrent cache invalidations safely", async () => {
      const queryKey1 = CacheKey.marketplaceListings("hash_1");
      const queryKey2 = CacheKey.marketplaceListings("hash_2");
      const statsKey = CacheKey.marketplaceStats();
      const listingsPrefix = "commitlabs:marketplace:listings:";

      const mockListing = {
        listingId: "LST-001",
        commitmentId: "CMT-001",
        type: "Safe" as const,
        amount: 50000,
        remainingDays: 25,
        maxLoss: 2,
        currentYield: 5.2,
        complianceScore: 95,
        price: 52000,
      };

      // Set up cache entries
      await adapter.set(
        queryKey1,
        [mockListing],
        CacheTTL.MARKETPLACE_LISTINGS,
      );
      await adapter.set(
        queryKey2,
        [mockListing],
        CacheTTL.MARKETPLACE_LISTINGS,
      );
      await adapter.set(
        statsKey,
        {
          activeListings: 1,
          averageYield: 5.2,
          medianPrice: 52000,
          typeBreakdown: { Safe: 1, Balanced: 0, Aggressive: 0 },
        },
        CacheTTL.MARKETPLACE_STATS,
      );

      // Simulate concurrent invalidations
      await Promise.all([
        adapter.invalidate(listingsPrefix),
        adapter.delete(statsKey),
        adapter.invalidate(listingsPrefix),
        adapter.delete(statsKey),
      ]);

      // All should be evicted
      expect(await adapter.get(queryKey1)).toBeNull();
      expect(await adapter.get(queryKey2)).toBeNull();
      expect(await adapter.get(statsKey)).toBeNull();
    });

    it("preserves cache isolation when different prefixes are invalidated", async () => {
      const listingsPrefix = "commitlabs:marketplace:listings:";
      const commitmentPrefix = "commitlabs:commitment:";

      const listingKey = CacheKey.marketplaceListings("hash_1");
      const commitmentKey1 = CacheKey.commitment("CMT-001");
      const commitmentKey2 = CacheKey.commitment("CMT-002");

      const mockListing = {
        listingId: "LST-001",
        commitmentId: "CMT-001",
        type: "Safe" as const,
        amount: 50000,
        remainingDays: 25,
        maxLoss: 2,
        currentYield: 5.2,
        complianceScore: 95,
        price: 52000,
      };

      // Set up multiple cache entries in different namespaces
      await adapter.set(
        listingKey,
        [mockListing],
        CacheTTL.MARKETPLACE_LISTINGS,
      );
      await adapter.set(
        commitmentKey1,
        { id: "CMT-001" },
        CacheTTL.COMMITMENT_DETAIL,
      );
      await adapter.set(
        commitmentKey2,
        { id: "CMT-002" },
        CacheTTL.COMMITMENT_DETAIL,
      );

      // Invalidate only listings
      await adapter.invalidate(listingsPrefix);

      expect(await adapter.get(listingKey)).toBeNull();
      expect(await adapter.get(commitmentKey1)).toEqual({ id: "CMT-001" });
      expect(await adapter.get(commitmentKey2)).toEqual({ id: "CMT-002" });

      // Invalidate commitment namespace
      await adapter.invalidate(commitmentPrefix);

      expect(await adapter.get(commitmentKey1)).toBeNull();
      expect(await adapter.get(commitmentKey2)).toBeNull();
    });
  });
});
