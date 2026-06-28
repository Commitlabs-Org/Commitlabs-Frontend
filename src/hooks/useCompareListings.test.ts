// @vitest-environment happy-dom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useCompareListings, MAX_COMPARE_LISTINGS } from '@/hooks/useCompareListings';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';

const makeListing = (id: string): MarketplaceCardProps => ({
  id,
  type: 'Safe',
  score: 90,
  amount: '$10,000',
  duration: '30 days',
  yield: '5%',
  maxLoss: '2%',
  owner: 'GOWNER1234567890',
  price: '$10,500',
  forSale: true,
});

describe('useCompareListings', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/marketplace');
    vi.restoreAllMocks();
  });

  it('starts empty and restores from session storage', async () => {
    sessionStorage.setItem(
      'marketplace-compare-listings',
      JSON.stringify([makeListing('007')]),
    );

    const { result } = renderHook(() => useCompareListings());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.count).toBe(1);
    expect(result.current.isPinned('007')).toBe(true);
  });

  it('pins and unpins listings', async () => {
    const { result } = renderHook(() => useCompareListings());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    act(() => {
      result.current.toggleListing(makeListing('1'));
    });

    expect(result.current.count).toBe(1);
    expect(result.current.isPinned('1')).toBe(true);

    act(() => {
      result.current.toggleListing(makeListing('1'));
    });

    expect(result.current.count).toBe(0);
  });

  it('caps pinned listings at three', async () => {
    const { result } = renderHook(() => useCompareListings());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    act(() => {
      result.current.toggleListing(makeListing('1'));
      result.current.toggleListing(makeListing('2'));
      result.current.toggleListing(makeListing('3'));
      result.current.toggleListing(makeListing('4'));
    });

    expect(result.current.count).toBe(MAX_COMPARE_LISTINGS);
    expect(result.current.isFull).toBe(true);
    expect(result.current.isPinned('4')).toBe(false);
  });

  it('persists updates to session storage', async () => {
    const { result } = renderHook(() => useCompareListings());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    act(() => {
      result.current.toggleListing(makeListing('42'));
    });

    const stored = JSON.parse(
      sessionStorage.getItem('marketplace-compare-listings') ?? '[]',
    ) as MarketplaceCardProps[];

    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe('42');
  });
});
