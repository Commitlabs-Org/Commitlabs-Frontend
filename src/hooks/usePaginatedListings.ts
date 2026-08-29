import { useState, useEffect, useCallback } from 'react';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';

interface PaginatedListingsResult {
  listings: MarketplaceCardProps[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

export function usePaginatedListings(
  params: Record<string, unknown> = {},
  pageSize: number = 9,
  disabled: boolean = false,
): PaginatedListingsResult {
  const serializedParams = JSON.stringify(params);
  const [listings, setListings] = useState<MarketplaceCardProps[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [prevParams, setPrevParams] = useState(serializedParams);

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
      if (page > 1 && !hasMore) return;

      setIsLoading(true);
      try {
        const searchParams = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          ...params,
        });
        const res = await fetch(`/api/marketplace/listings?${searchParams.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch listings');
        const data = await res.json();

        if (!active) return;

        const newCards: MarketplaceCardProps[] = Array.isArray(data.cards) ? data.cards : [];
        setListings((prev) => {
          if (page === 1) return newCards;
          const existingIds = new Set(prev.map((item) => item.id));
          const filtered = newCards.filter((item) => !existingIds.has(item.id));
          return [...prev, ...filtered];
        });
        setHasMore(newCards.length === pageSize);
      } catch (_e) {
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
  }, [page, serializedParams, pageSize, disabled, hasMore, params]);

  const loadMore = useCallback(() => {
    if (!disabled && !isLoading && hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [isLoading, hasMore, disabled]);

  return { listings, isLoading, hasMore, loadMore };
}
