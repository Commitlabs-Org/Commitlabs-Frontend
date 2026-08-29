import { memo, useMemo, useEffect, useRef, useCallback } from 'react';
import type { MarketplaceCardProps } from './MarketplaceCard';
import { MarketplaceCard } from './MarketplaceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';

export interface MarketplaceGridProps {
  /** Optional pre‑loaded items – if omitted the component fetches via the hook */
  items?: MarketplaceCardProps[];
  isComparePinned?: (id: string) => boolean;
  isCompareFull?: boolean;
  onCompareToggle?: (listing: MarketplaceCardProps) => void;
  onView?: (id: string) => void;
  /** Additional query parameters for filtering/sorting */
  queryParams?: Record<string, unknown>;
  /** Optional comparator applied before rendering. Stabilize with useCallback. */
  sortFn?: (a: MarketplaceCardProps, b: MarketplaceCardProps) => number;
  /** Optional predicate applied before rendering. Stabilize with useCallback. */
  filterFn?: (item: MarketplaceCardProps) => boolean;
}

// VIRTUALIZATION THRESHOLD — engage CSS content-visibility windowing only
// when the list is large enough to justify the overhead.
const VIRTUALIZE_THRESHOLD = 50;

/**
 * MarketplaceGrid
 *
 * Performance notes:
 *   - `filterFn` / `sortFn` props are applied via `useMemo` so the derived
 *     list is only recomputed when `items`, `filterFn`, or `sortFn` change.
 *   - `MarketplaceCard` is already wrapped in `React.memo`, so only cards
 *     with changed props are re-rendered during filter/sort updates.
 *   - For lists larger than VIRTUALIZE_THRESHOLD the grid applies CSS
 *     `content-visibility: auto` per card — a zero-dependency windowing
 *     approach that lets the browser skip layout/paint for off-screen items
 *     while preserving DOM presence for accessibility and SSR compatibility.
 */
export const MarketplaceGrid = memo(function MarketplaceGrid({
  items,
  isComparePinned,
  isCompareFull = false,
  onCompareToggle,
  onView,
  queryParams = {},
  sortFn,
  filterFn,
}: MarketplaceGridProps) {
  const safeOnCompareToggle = useCallback(
    (listing: MarketplaceCardProps) => {
      if (typeof onCompareToggle === 'function') {
        return onCompareToggle(listing);
      }
    },
    [onCompareToggle],
  );

  const safeOnView = useCallback(
    (id: string) => {
      if (typeof onView === 'function' && id && typeof id === 'string') {
        return onView(id);
      }
    },
    [onView],
  );

  const safeIsComparePinned = useCallback(
    (id: string) => {
      if (typeof isComparePinned === 'function' && id) {
        return isComparePinned(id);
      }
      return false;
    },
    [isComparePinned],
  );

  // Use the pagination hook when no items are supplied.
  // We disable the hook when pre-loaded items are supplied.
  const { listings, isLoading, hasMore, loadMore } = usePaginatedListings(queryParams, 9, !!items);
  const rawItems = items ?? listings;

  const sanitizedItems = useMemo(() => {
    if (!Array.isArray(rawItems)) return [];
    return rawItems.filter((item): item is MarketplaceCardProps => {
      return (
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        item.id.trim().length > 0 &&
        typeof item.type === 'string' &&
        ['Safe', 'Balanced', 'Aggressive'].includes(item.type) &&
        typeof item.amount === 'string' &&
        typeof item.duration === 'string' &&
        typeof item.yield === 'string' &&
        typeof item.maxLoss === 'string' &&
        typeof item.price === 'string'
      );
    });
  }, [rawItems]);

  // Memoize derived list — only recomputes when items / predicates change.
  const displayedItems = useMemo(() => {
    let result = sanitizedItems;
    if (filterFn) {
      try {
        result = result.filter(filterFn);
      } catch {
        result = [];
      }
    }
    if (sortFn) {
      try {
        result = [...result].sort(sortFn);
      } catch {
        result = [];
      }
    }
    return result;
  }, [sanitizedItems, filterFn, sortFn]);

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

  const isLargeList = displayedItems.length > VIRTUALIZE_THRESHOLD;

  return (
    <section className="mt-6" aria-label="Marketplace listings">
      <ul className="list-none p-0 m-0 grid grid-cols-3 gap-6 max-[1024px]:grid-cols-2 max-[720px]:grid-cols-1">
        {displayedItems.map((item) => {
          const compareSelected = safeIsComparePinned(item.id);
          return (
            <li
              key={item.id}
              className="min-h-[280px]"
              style={
                isLargeList
                  ? { contentVisibility: 'auto', containIntrinsicSize: '0 320px' }
                  : undefined
              }
            >
              <MarketplaceCard
                {...item}
                compareSelected={compareSelected}
                compareDisabled={isCompareFull && !compareSelected}
                {...(onCompareToggle ? { onCompareToggle: () => safeOnCompareToggle(item) } : {})}
                onView={safeOnView}
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
});
