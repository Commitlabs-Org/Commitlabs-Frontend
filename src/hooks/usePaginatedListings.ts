import { useState, useEffect, useCallback } from 'react';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';

/**
 * Hook to fetch marketplace listings with page-based pagination.
 * It appends new pages to the existing list and provides helpers for
 * loading more data, resetting when filters change, and exposing loading
 * and end-of-list states.
 */
export function usePaginatedListings(
  /**
   * Optional query parameters (filters, sort, etc.) that will be serialized
   * into the request URL. Changing this object will reset pagination.
   */
  params: Record<string, any> = {},
  /** Number of items per page - defaults to 9 to match the UI grid */
  pageSize: number = 9,
  /** If true, the hook will not fetch or reset state */
  disabled: boolean = false,
) {
  const serializedParams = JSON.stringify(params);
  const [listings, setListings] = useState<MarketplaceCardProps[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [prevParams, setPrevParams] = useState(serializedParams);

  // Synchronously reset pagination state during render when query parameters change
  if (!disabled && prevParams !== serializedParams) {
    setPrevParams(serializedParams);
    setPage(1);
    setListings([]);
    setHasMore(true);
  }

  useEffect(() => {
    if (disabled) return;

    let active = true;

    async function fetchData() {
      // If we are beyond page 1 and there is no more data, don't fetch
      if (page > 1 && !hasMore) return;

      setIsLoading(true);
      try {
        const searchParams = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          ...JSON.parse(serializedParams),
        });
        const res = await fetch(`/api/marketplace/listings?${searchParams.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch listings');
        const data = await res.json();

        if (!active) return;

        const newCards: MarketplaceCardProps[] = data.cards ?? [];
        setListings(prev => {
          if (page === 1) {
            return newCards;
          }
          // Avoid duplicate items by checking IDs
          const existingIds = new Set(prev.map(item => item.id));
          const filteredNewCards = newCards.filter(item => !existingIds.has(item.id));
          return [...prev, ...filteredNewCards];
        });
        setHasMore(newCards.length === pageSize);
      } catch (e) {
        console.error(e);
        if (active) {
          setHasMore(false);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      active = false;
    };
  }, [page, serializedParams, pageSize, disabled]);

  const loadMore = useCallback(() => {
    if (!disabled && !isLoading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [isLoading, hasMore, disabled]);

  return { listings, isLoading, hasMore, loadMore };
}
