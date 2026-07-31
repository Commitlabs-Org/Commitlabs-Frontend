import { describe, expect, it } from 'vitest';
import { detectMarketplaceAlerts, type MarketplaceSnapshot } from './useMarketplaceAlerts';

const oldListing: MarketplaceSnapshot = {
  id: 'listing-1',
  title: 'Safe commitment',
  price: 100,
  status: 'Active',
};

describe('detectMarketplaceAlerts', () => {
  it('detects price drops and sold transitions only for watched listings', () => {
    const alerts = detectMarketplaceAlerts(
      new Map([[oldListing.id, oldListing]]),
      [{ ...oldListing, price: 80, status: 'Sold' }],
      new Set(['listing-1']),
    );

    expect(alerts.map((alert) => alert.type)).toEqual(['price-drop', 'status-change']);
  });

  it('ignores untracked listings and unchanged states', () => {
    expect(
      detectMarketplaceAlerts(
        new Map([[oldListing.id, oldListing]]),
        [{ ...oldListing }],
        new Set(),
      ),
    ).toEqual([]);
  });
});
