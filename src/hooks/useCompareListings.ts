'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';

export const MAX_COMPARE_LISTINGS = 3;
const STORAGE_KEY = 'marketplace-compare-listings';

function readStoredListings(): MarketplaceCardProps[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MarketplaceCardProps[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_COMPARE_LISTINGS) : [];
  } catch {
    return [];
  }
}

function writeStoredListings(listings: MarketplaceCardProps[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
  } catch {
    // Ignore quota or privacy-mode errors.
  }
}

export function useCompareListings() {
  const [listings, setListings] = useState<MarketplaceCardProps[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setListings(readStoredListings());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    writeStoredListings(listings);
  }, [listings, isHydrated]);

  const isPinned = useCallback(
    (id: string) => listings.some((listing) => listing.id === id),
    [listings],
  );

  const isFull = listings.length >= MAX_COMPARE_LISTINGS;

  const toggleListing = useCallback((listing: MarketplaceCardProps) => {
    setListings((current) => {
      const exists = current.some((item) => item.id === listing.id);
      if (exists) {
        return current.filter((item) => item.id !== listing.id);
      }
      if (current.length >= MAX_COMPARE_LISTINGS) {
        return current;
      }
      return [...current, listing];
    });
  }, []);

  const removeListing = useCallback((id: string) => {
    setListings((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setListings([]);
  }, []);

  return {
    listings,
    isPinned,
    isFull,
    toggleListing,
    removeListing,
    clearAll,
    count: listings.length,
    isHydrated,
  };
}
