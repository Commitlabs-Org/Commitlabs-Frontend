'use client';

import { useCallback, useEffect, useState } from 'react';

export const MAX_RECENT_LISTINGS = 10;
const STORAGE_KEY = 'marketplace-recently-viewed';

function readStoredRecentIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT_LISTINGS) : [];
  } catch {
    return [];
  }
}

function writeStoredRecentIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore quota/privacy errors
  }
}

export function useRecentlyViewed(cap = MAX_RECENT_LISTINGS) {
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setRecentIds(readStoredRecentIds());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    writeStoredRecentIds(recentIds);
  }, [recentIds, isHydrated]);

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
    [cap]
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
