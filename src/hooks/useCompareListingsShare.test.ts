// @vitest-environment happy-dom

import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMPARE_QUERY_PARAM,
  MAX_COMPARE_LISTINGS,
  useCompareListings,
} from '@/hooks/useCompareListings';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';

const makeListing = (id: string): MarketplaceCardProps => ({
  id,
  type: 'Balanced',
  score: 90,
  amount: '$10,000',
  duration: '30 days',
  yield: '5%',
  maxLoss: '2%',
  owner: 'GOWNER1234567890',
  price: '$10,500',
  forSale: true,
});

const getCompareParam = () =>
  new URLSearchParams(window.location.search).get(COMPARE_QUERY_PARAM);

describe('useCompareListings share URL synchronization', () => {
  const listings = ['001', '002', '003', '004'].map(makeListing);

  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/marketplace');
    vi.restoreAllMocks();
  });

  it('restores a capped comparison set from the URL and ignores invalid ids', async () => {
    window.history.replaceState(
      null,
      '',
      '/marketplace?compare=002,missing,001,002,003,004',
    );

    const { result } = renderHook(() => useCompareListings(listings));

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.listings.map((listing) => listing.id)).toEqual([
      '002',
      '001',
      '003',
    ]);
    expect(result.current.count).toBe(MAX_COMPARE_LISTINGS);
    expect(result.current.restoredFromUrl).toBe(true);
    expect(getCompareParam()).toBe('002,001,003');
  });

  it('keeps the URL in sync while users edit the comparison set', async () => {
    const { result } = renderHook(() => useCompareListings(listings));

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    act(() => {
      result.current.toggleListing(listings[0]);
      result.current.toggleListing(listings[1]);
    });

    expect(getCompareParam()).toBe('001,002');

    act(() => {
      result.current.removeListing('001');
    });

    expect(getCompareParam()).toBe('002');

    act(() => {
      result.current.clearAll();
    });

    expect(getCompareParam()).toBeNull();
  });
});
