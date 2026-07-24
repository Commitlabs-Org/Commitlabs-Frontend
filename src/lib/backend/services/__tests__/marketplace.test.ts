import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock cache module before importing marketplace
vi.mock('@/lib/backend/cache/factory', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
vi.mock('@/lib/backend/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import {
  listMarketplaceListings,
  selectFeaturedMarketplaceListings,
  isMarketplaceSortBy,
  getMarketplaceSortKeys,
  FEATURED_MARKETPLACE_CONFIG,
  type MarketplacePublicListing,
  type FeaturedMarketplaceConfig,
} from '../marketplace';

const FIXTURE_LISTINGS: MarketplacePublicListing[] = [
  {
    listingId: 'LST-A',
    commitmentId: 'CMT-A',
    type: 'Safe',
    amount: 50000,
    remainingDays: 25,
    maxLoss: 2,
    currentYield: 5.2,
    complianceScore: 95,
    price: 52000,
  },
  {
    listingId: 'LST-B',
    commitmentId: 'CMT-B',
    type: 'Balanced',
    amount: 100000,
    remainingDays: 45,
    maxLoss: 8,
    currentYield: 12.5,
    complianceScore: 88,
    price: 105000,
  },
  {
    listingId: 'LST-C',
    commitmentId: 'CMT-C',
    type: 'Aggressive',
    amount: 250000,
    remainingDays: 80,
    maxLoss: 100,
    currentYield: 18.7,
    complianceScore: 76,
    price: 262000,
  },
  {
    listingId: 'LST-D',
    commitmentId: 'CMT-D',
    type: 'Safe',
    amount: 75000,
    remainingDays: 15,
    maxLoss: 2,
    currentYield: 4.8,
    complianceScore: 92,
    price: 76500,
  },
  {
    listingId: 'LST-E',
    commitmentId: 'CMT-E',
    type: 'Balanced',
    amount: 150000,
    remainingDays: 55,
    maxLoss: 8,
    currentYield: 11.3,
    complianceScore: 85,
    price: 155000,
  },
];

describe('listMarketplaceListings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('type filtering', () => {
    it('returns only Safe listings when type=Safe', async () => {
      const results = await listMarketplaceListings({ type: 'Safe' });
      expect(results.every((l) => l.type === 'Safe')).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns only Balanced listings when type=Balanced', async () => {
      const results = await listMarketplaceListings({ type: 'Balanced' });
      expect(results.every((l) => l.type === 'Balanced')).toBe(true);
    });

    it('returns only Aggressive listings when type=Aggressive', async () => {
      const results = await listMarketplaceListings({ type: 'Aggressive' });
      expect(results.every((l) => l.type === 'Aggressive')).toBe(true);
    });

    it('returns all listings when no type filter is applied', async () => {
      const results = await listMarketplaceListings({});
      expect(results.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('compliance filtering', () => {
    it('filters listings with complianceScore >= minCompliance', async () => {
      const results = await listMarketplaceListings({ minCompliance: 90 });
      expect(results.every((l) => l.complianceScore >= 90)).toBe(true);
    });

    it('returns no listings when minCompliance is above all scores', async () => {
      const results = await listMarketplaceListings({ minCompliance: 999 });
      expect(results).toHaveLength(0);
    });

    it('returns all listings when minCompliance is 0', async () => {
      const allResults = await listMarketplaceListings({});
      const filteredResults = await listMarketplaceListings({ minCompliance: 0 });
      expect(filteredResults.length).toBe(allResults.length);
    });
  });

  describe('maxLoss filtering', () => {
    it('filters listings with maxLoss <= provided maxLoss', async () => {
      const results = await listMarketplaceListings({ maxLoss: 8 });
      expect(results.every((l) => l.maxLoss <= 8)).toBe(true);
    });

    it('returns no listings when maxLoss is below all values', async () => {
      const results = await listMarketplaceListings({ maxLoss: 0 });
      expect(results).toHaveLength(0);
    });
  });

  describe('amount range filtering', () => {
    it('filters listings with amount >= minAmount', async () => {
      const results = await listMarketplaceListings({ minAmount: 100000 });
      expect(results.every((l) => l.amount >= 100000)).toBe(true);
    });

    it('filters listings with amount <= maxAmount', async () => {
      const results = await listMarketplaceListings({ maxAmount: 100000 });
      expect(results.every((l) => l.amount <= 100000)).toBe(true);
    });

    it('supports combining minAmount and maxAmount', async () => {
      const results = await listMarketplaceListings({ minAmount: 50000, maxAmount: 150000 });
      expect(results.every((l) => l.amount >= 50000 && l.amount <= 150000)).toBe(true);
    });
  });

  describe('combined filters', () => {
    it('supports filtering by type and minCompliance together', async () => {
      const results = await listMarketplaceListings({ type: 'Safe', minCompliance: 90 });
      expect(results.every((l) => l.type === 'Safe' && l.complianceScore >= 90)).toBe(true);
    });

    it('returns empty array when filters match no listings', async () => {
      const results = await listMarketplaceListings({ type: 'Aggressive', minCompliance: 999 });
      expect(results).toHaveLength(0);
    });
  });

  describe('sorting', () => {
    it('defaults to sorting by price descending', async () => {
      const results = await listMarketplaceListings({});
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].price).toBeGreaterThanOrEqual(results[i].price);
      }
    });

    it('sorts by complianceScore descending', async () => {
      const results = await listMarketplaceListings({ sortBy: 'complianceScore' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].complianceScore).toBeGreaterThanOrEqual(results[i].complianceScore);
      }
    });

    it('sorts by currentYield descending', async () => {
      const results = await listMarketplaceListings({ sortBy: 'currentYield' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].currentYield).toBeGreaterThanOrEqual(results[i].currentYield);
      }
    });

    it('sorts by remainingDays ascending', async () => {
      const results = await listMarketplaceListings({ sortBy: 'remainingDays' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].remainingDays).toBeLessThanOrEqual(results[i].remainingDays);
      }
    });

    it('sorts by maxLoss ascending', async () => {
      const results = await listMarketplaceListings({ sortBy: 'maxLoss' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].maxLoss).toBeLessThanOrEqual(results[i].maxLoss);
      }
    });

    it('sorts by amount descending', async () => {
      const results = await listMarketplaceListings({ sortBy: 'amount' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].amount).toBeGreaterThanOrEqual(results[i].amount);
      }
    });

    it('falls back to price sort for unknown sortBy value', async () => {
      const resultsDefault = await listMarketplaceListings({});
      const resultsUnknown = await listMarketplaceListings({ sortBy: 'unknown_key' });
      expect(resultsUnknown.map((l) => l.listingId)).toEqual(
        resultsDefault.map((l) => l.listingId)
      );
    });
  });
});

describe('selectFeaturedMarketplaceListings', () => {
  it('filters by minComplianceScore and maxLoss from config', () => {
    const results = selectFeaturedMarketplaceListings(FIXTURE_LISTINGS);
    expect(
      results.every(
        (l) =>
          l.complianceScore >= FEATURED_MARKETPLACE_CONFIG.minComplianceScore &&
          l.maxLoss <= FEATURED_MARKETPLACE_CONFIG.maxLoss
      )
    ).toBe(true);
  });

  it('respects the limit from config', () => {
    const results = selectFeaturedMarketplaceListings(FIXTURE_LISTINGS);
    expect(results.length).toBeLessThanOrEqual(FEATURED_MARKETPLACE_CONFIG.limit);
  });

  it('returns empty array when no listings pass the filter', () => {
    const results = selectFeaturedMarketplaceListings(FIXTURE_LISTINGS, {
      minComplianceScore: 999,
      maxLoss: 0,
      limit: 4,
    });
    expect(results).toHaveLength(0);
  });

  it('returns all matching listings when fewer than limit qualify', () => {
    const single = FIXTURE_LISTINGS.filter((l) => l.listingId === 'LST-A');
    const results = selectFeaturedMarketplaceListings(single, {
      minComplianceScore: 90,
      maxLoss: 5,
      limit: 4,
    });
    expect(results).toHaveLength(1);
    expect(results[0].listingId).toBe('LST-A');
  });

  it('sorts by complianceScore descending as primary key', () => {
    const results = selectFeaturedMarketplaceListings(FIXTURE_LISTINGS);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].complianceScore).toBeGreaterThanOrEqual(results[i].complianceScore);
    }
  });

  it('produces stable order for ties via listingId lexicographic comparison', () => {
    const tiedListings: MarketplacePublicListing[] = [
      {
        listingId: 'LST-Z',
        commitmentId: 'CMT-Z',
        type: 'Safe',
        amount: 10000,
        remainingDays: 10,
        maxLoss: 2,
        currentYield: 5.0,
        complianceScore: 90,
        price: 10000,
      },
      {
        listingId: 'LST-A',
        commitmentId: 'CMT-A',
        type: 'Safe',
        amount: 10000,
        remainingDays: 10,
        maxLoss: 2,
        currentYield: 5.0,
        complianceScore: 90,
        price: 10000,
      },
    ];
    const config: FeaturedMarketplaceConfig = { minComplianceScore: 85, maxLoss: 8, limit: 10 };
    const results = selectFeaturedMarketplaceListings(tiedListings, config);
    expect(results[0].listingId).toBe('LST-A');
    expect(results[1].listingId).toBe('LST-Z');
  });

  it('does not mutate the input array', () => {
    const copy = [...FIXTURE_LISTINGS];
    selectFeaturedMarketplaceListings(FIXTURE_LISTINGS);
    expect(FIXTURE_LISTINGS).toEqual(copy);
  });
});

describe('isMarketplaceSortBy', () => {
  it('returns true for valid sort keys', () => {
    expect(isMarketplaceSortBy('price')).toBe(true);
    expect(isMarketplaceSortBy('amount')).toBe(true);
    expect(isMarketplaceSortBy('complianceScore')).toBe(true);
    expect(isMarketplaceSortBy('remainingDays')).toBe(true);
    expect(isMarketplaceSortBy('maxLoss')).toBe(true);
    expect(isMarketplaceSortBy('currentYield')).toBe(true);
  });

  it('returns false for invalid sort keys', () => {
    expect(isMarketplaceSortBy('unknown')).toBe(false);
    expect(isMarketplaceSortBy('')).toBe(false);
    expect(isMarketplaceSortBy('Price')).toBe(false);
  });
});

describe('getMarketplaceSortKeys', () => {
  it('returns all valid sort keys', () => {
    const keys = getMarketplaceSortKeys();
    expect(keys).toContain('price');
    expect(keys).toContain('amount');
    expect(keys).toContain('complianceScore');
    expect(keys).toContain('remainingDays');
    expect(keys).toContain('maxLoss');
    expect(keys).toContain('currentYield');
  });

  it('returns only strings', () => {
    const keys = getMarketplaceSortKeys();
    expect(keys.every((k) => typeof k === 'string')).toBe(true);
  });
});
