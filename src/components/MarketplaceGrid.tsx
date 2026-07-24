import type { MarketplaceCardProps } from './MarketplaceCard';
import { MarketplaceCard } from './MarketplaceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { useEffect, useRef } from 'react';

export interface MarketplaceGridProps {
  /** Optional pre‑loaded items – if omitted the component fetches via the hook */
  items?: MarketplaceCardProps[];
  isComparePinned?: (id: string) => boolean;
  isCompareFull?: boolean;
  onCompareToggle?: (listing: MarketplaceCardProps) => void;
  /** Additional query parameters for filtering/sorting */
  queryParams?: Record<string, any>;
}

export function MarketplaceGrid({
  items,
  isComparePinned,
  isCompareFull = false,
  onCompareToggle,
  queryParams = {},
}: MarketplaceGridProps) {
  // Use the pagination hook when no items are supplied.
  // We disable the hook when pre-loaded items are supplied.
  const { listings, isLoading, hasMore, loadMore } = usePaginatedListings(
    queryParams,
    9,
    !!items
  );
  const displayedItems = items ?? listings;

  // IntersectionObserver for infinite scroll (sentinel element)
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (items || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      });
    });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [items, hasMore, loadMore]);

  if (!displayedItems || displayedItems.length === 0) {
    return (
      <section className="mt-10" aria-label="Marketplace listings">
        <EmptyState
          title="No commitments available"
          description="New offers will appear here once they are listed."
          className="rounded-[20px] px-6 border border-[rgba(255,255,255,0.12)] bg-[radial-gradient(140%_140%_at_0%_0%,rgba(255,255,255,0.06),rgba(255,255,255,0.01)_65%),rgba(0,0,0,0.45)] shadow-[0_18px_45px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        />
      </section>
    );
  }

  return (
    <section className="mt-6" aria-label="Marketplace listings">
      <ul className="list-none p-0 m-0 grid grid-cols-3 gap-6 max-[1024px]:grid-cols-2 max-[720px]:grid-cols-1">
        {displayedItems.map((item) => {
          const compareSelected = isComparePinned?.(item.id) ?? false;
          return (
            <li key={item.id} className="min-h-[280px]">
              <MarketplaceCard
                {...item}
                compareSelected={compareSelected}
                compareDisabled={isCompareFull && !compareSelected}
                onCompareToggle={onCompareToggle ? () => onCompareToggle(item) : undefined}
              />
            </li>
          );
        })}
        {/* Loading indicator row */}
        {isLoading && hasMore && !items && (
          <li className="col-span-full flex justify-center py-4" aria-live="polite">
            Loading more listings…
          </li>
        )}
        {/* Load more button */}
        {hasMore && !isLoading && !items && (
          <li className="col-span-full flex justify-center py-4">
            <button
              type="button"
              className="rounded-xl border px-5 py-2 bg-[rgba(8,12,16,0.95)] text-white hover:border-[rgba(0,212,255,0.45)]"
              onClick={loadMore}
            >
              Load more
            </button>
          </li>
        )}
        {/* Sentinel for infinite scroll */}
        {!items && <div ref={sentinelRef} className="hidden" />}
      </ul>
    </section>
  );
}
