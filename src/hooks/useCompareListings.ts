'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';

export const MAX_COMPARE_LISTINGS = 3;
const STORAGE_KEY = 'marketplace-compare-listings';
export const COMPARE_QUERY_PARAM = 'compare';

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }

  return unique;
}

function readUrlListingIds(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(COMPARE_QUERY_PARAM);
    if (!raw) return [];
    return uniqueIds(raw.split(','));
  } catch {
    return [];
  }
}

function writeUrlListingIds(ids: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    const cappedIds = uniqueIds(ids).slice(0, MAX_COMPARE_LISTINGS);

    if (cappedIds.length > 0) {
      url.searchParams.set(COMPARE_QUERY_PARAM, cappedIds.join(','));
    } else {
      url.searchParams.delete(COMPARE_QUERY_PARAM);
    }

    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    // URL synchronization should never block comparison selection.
  }
}

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

function resolveListingsFromIds(
  ids: string[],
  listingById: Map<string, MarketplaceCardProps>,
): MarketplaceCardProps[] {
  return ids
    .map((id) => listingById.get(id))
    .filter((listing): listing is MarketplaceCardProps => Boolean(listing))
    .slice(0, MAX_COMPARE_LISTINGS);
}

export function useCompareListings(
  availableListings: MarketplaceCardProps[] = [],
) {
  const [listings, setListings] = useState<MarketplaceCardProps[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [restoredFromUrl, setRestoredFromUrl] = useState(false);
  const hasHydratedRef = useRef(false);

  const listingById = useMemo(
    () => new Map(availableListings.map((listing) => [listing.id, listing])),
    [availableListings],
  );

  const hydrateFromCurrentUrl = useCallback(() => {
    const urlIds = readUrlListingIds();

    if (urlIds.length > 0 && availableListings.length > 0) {
      const restoredListings = resolveListingsFromIds(urlIds, listingById);
      setListings(restoredListings);
      setRestoredFromUrl(restoredListings.length >= 2);
      setIsHydrated(true);
      return true;
    }

    if (urlIds.length === 0) {
      setListings(readStoredListings());
      setRestoredFromUrl(false);
      setIsHydrated(true);
      return true;
    }

    return false;
  }, [availableListings.length, listingById]);

  useEffect(() => {
    if (hasHydratedRef.current) return;

    if (hydrateFromCurrentUrl()) {
      hasHydratedRef.current = true;
    }
  }, [hydrateFromCurrentUrl]);

  useEffect(() => {
    if (!isHydrated) return;
    writeStoredListings(listings);
    writeUrlListingIds(listings.map((listing) => listing.id));
  }, [listings, isHydrated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      hydrateFromCurrentUrl();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hydrateFromCurrentUrl]);

  const isPinned = useCallback(
    (id: string) => listings.some((listing) => listing.id === id),
    [listings],
  );

  const isFull = listings.length >= MAX_COMPARE_LISTINGS;

  const toggleListing = useCallback((listing: MarketplaceCardProps) => {
    setRestoredFromUrl(false);
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
    setRestoredFromUrl(false);
    setListings((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setRestoredFromUrl(false);
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
    restoredFromUrl,
  };
}
