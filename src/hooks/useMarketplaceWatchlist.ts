'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export const MARKETPLACE_WATCHLIST_KEY = 'commitlabs:marketplace-watchlist';

function readWatchlist(): string[] {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(MARKETPLACE_WATCHLIST_KEY) ?? '[]',
    );
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function useMarketplaceWatchlist() {
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => setSavedIds(readWatchlist()), []);

  useEffect(() => {
    window.localStorage.setItem(MARKETPLACE_WATCHLIST_KEY, JSON.stringify(savedIds));
  }, [savedIds]);

  const toggle = useCallback((listingId: string) => {
    setSavedIds((current) =>
      current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId],
    );
  }, []);

  const isSaved = useCallback((listingId: string) => savedIds.includes(listingId), [savedIds]);
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  return { savedIds, savedSet, isSaved, toggle };
}
