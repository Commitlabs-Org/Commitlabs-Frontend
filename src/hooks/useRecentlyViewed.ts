'use client';

import { useCallback, useEffect, useState } from 'react';

export const MAX_RECENT_LISTINGS = 10;
const DEFAULT_STORAGE_KEY = 'marketplace-recently-viewed';

/** Storage key for the "recently viewed commitments" rail on the commitment detail page. */
export const RECENTLY_VIEWED_COMMITMENTS_KEY = 'commitments-recently-viewed';

function readStoredRecentIds(storageKey: string, cap: number): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .slice(0, MAX_RECENT_LISTINGS);
  } catch {
    return [];
  }
}

function writeStoredRecentIds(storageKey: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // Ignore quota/privacy errors
  }
}

/**
 * Tracks the most recently viewed item ids (marketplace listings by default;
 * pass a different `storageKey` -- e.g. `RECENTLY_VIEWED_COMMITMENTS_KEY` --
 * to track a different domain of ids independently).
 */
export function useRecentlyViewed(cap = MAX_RECENT_LISTINGS, storageKey = DEFAULT_STORAGE_KEY) {
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setRecentIds(readStoredRecentIds(storageKey, cap));
    setIsHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated) return;
    writeStoredRecentIds(storageKey, recentIds);
  }, [recentIds, isHydrated, storageKey]);

  const addView = useCallback(
    (id: string) => {
      setRecentIds((current) => {
        const filtered = current.filter((item) => item !== id);
        const updated = [id, ...filtered];
        if (updated.length > cap) {
          return updated.slice(0, cap);
        }
        return updated;
      });
    },
    [cap],
  );

  const clearAll = useCallback(() => {
    setRecentIds([]);
  }, []);

  return {
    recentIds,
    addView,
    clearAll,
    isHydrated,
  };
}
