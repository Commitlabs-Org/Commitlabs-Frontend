import { memo, useMemo, useEffect, useRef, useCallback } from 'react';
import type { MarketplaceCardProps } from './MarketplaceCard';
import { MarketplaceCard } from './MarketplaceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import type { ListingsFetchState } from '@/hooks/usePaginatedListings';

export interface MarketplaceGridProps {
  items?: MarketplaceCardProps[];
  isComparePinned?: (id: string) => boolean;
  isCompareFull?: boolean;
  onCompareToggle?: (listing: MarketplaceCardProps) => void;
  onView?: (id: string) => void;
  /** Additional query parameters for filtering/sorting */
  queryParams?: Record<string, unknown>;
  /** Optional comparator applied before rendering. Stabilize with useCallback. */
  sortFn?: (a: MarketplaceCardProps, b: MarketplaceCardProps) => number;
  filterFn?: (item: MarketplaceCardProps) => boolean;
  onStateChange?: (state: ListingsFetchState) => void;
}

const VIRTUALIZE_THRESHOLD = 50;

const LOADING_SKELETON_COUNT = 6;

function SkeletonCard() {
  return (
    <div
      className="min-h-[280px] rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] animate-pulse"
      aria-hidden="true"
    />
  );
}

function fetchStateToBannerInfo(state: ListingsFetchState, error: { message?: string; retryable?: boolean } | null) {
  switch (state) {
    case 'ERROR_STALE':
      return {
        tone: 'warning' as const,
        title: 'Showing older listings',
        message: error?.retryable
          ? 'A network error interrupted the latest refresh. Retrying automatically or use the button below.'
          : 'Latest listings could not be loaded. Showing previously cached results.',
        showRetry: error?.retryable !== false,
      };
    case 'ERROR_EMPTY':
      return {
        tone: 'critical' as const,
        title: 'Unable to load listings',
        message: error?.message ?? 'Please check your network connection and try again.',
        showRetry: true,
      };
    case 'EXHAUSTED':
      return {
        tone: 'info' as const,
        title: null,
        message: 'You have reached the end of available listings.',
        showRetry: false,
      };
    default:
      return null;
  }
}

export const MarketplaceGrid = memo(function MarketplaceGrid({
  items,
  isComparePinned,
  isCompareFull = false,
  onCompareToggle,
  onView,
  queryParams = {},
  sortFn,
  filterFn,
  onStateChange,
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

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreInFlightRef = useRef(false);
  const lastLoadMoreGenRef = useRef<number>(-1);

  useEffect(() => {
    if (items || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (loadMoreInFlightRef.current) return;
          if (state === 'LOADING_MORE' || state === 'LOADING_INITIAL' || state === 'REFRESHING') return;
          if (lastLoadMoreGenRef.current === generationRef.current) return;
          lastLoadMoreGenRef.current = generationRef.current;
          loadMoreInFlightRef.current = true;
          loadMore().finally(() => {
            loadMoreInFlightRef.current = false;
          });
        }
      });
    }, {
      rootMargin: '200px 0px',
      threshold: 0.01,
    });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [items, hasMore, loadMore, state]);

  const handleManualLoadMore = useCallback(() => {
    if (state === 'LOADING_MORE' || state === 'LOADING_INITIAL' || state === 'REFRESHING') return;
    if (loadMoreInFlightRef.current) return;
    loadMoreInFlightRef.current = true;
    lastLoadMoreGenRef.current = generationRef.current;
    loadMore().finally(() => {
      loadMoreInFlightRef.current = false;
    });
  }, [loadMore, state]);

  const banner = !items ? fetchStateToBannerInfo(state, error) : null;

  const showSkeleton = !items && isLoadingInitial;
  const skeletonCount = showSkeleton ? Math.min(LOADING_SKELETON_COUNT, Math.max(displayedItems.length, LOADING_SKELETON_COUNT)) : LOADING_SKELETON_COUNT;

  if (showSkeleton && displayedItems.length === 0) {
    return (
      <section className="mt-6" aria-label="Marketplace listings" aria-busy="true">
        <ul
          aria-label="Loading marketplace listings"
          role="list"
          className="list-none p-0 m-0 grid grid-cols-3 gap-6 max-[1024px]:grid-cols-2 max-[720px]:grid-cols-1"
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <li key={`sk-${i}`} role="listitem">
              <SkeletonCard />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (state === 'ERROR_EMPTY' && !items) {
    return (
      <section className="mt-10" aria-label="Marketplace listings">
        <EmptyState
          title="Unable to load listings"
          description={error?.message ?? 'Please check your network connection and try again.'}
          className="rounded-[20px] px-6 border border-[rgba(255,80,80,0.28)] bg-[radial-gradient(140%_140%_at_0%_0%,rgba(255,120,120,0.06),rgba(255,80,80,0.02)_65%),rgba(20,0,0,0.45)] shadow-[0_18px_45px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,120,120,0.08)]"
        >
          <div className="mt-4 flex items-center gap-3 justify-center flex-wrap">
            <button
              type="button"
              className="rounded-xl border border-[rgba(255,255,255,0.18)] px-5 py-2 bg-[rgba(8,12,16,0.95)] text-white hover:border-[rgba(0,212,255,0.45)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,212,255,0.35)] transition"
              onClick={() => refresh(true)}
              aria-label="Retry loading marketplace listings"
            >
              Retry
            </button>
            {typeof retryCount === 'number' && retryCount > 0 && (
              <span className="text-xs text-[rgba(255,255,255,0.55)]">
                Retry attempts: {retryCount}
              </span>
            )}
            {error?.retryAfterSeconds && (
              <span className="text-xs text-[rgba(255,255,255,0.55)]">
                Server suggested retry after: {error.retryAfterSeconds}s
              </span>
            )}
          </div>
        </EmptyState>
      </section>
    );
  }

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
  const hasErrorBanner = banner && banner.title !== null;

  return (
    <section className="mt-6" aria-label="Marketplace listings" aria-busy={isLoading}>
      {(banner) && (
        <div
          role={banner.tone === 'critical' ? 'alert' : 'status'}
          aria-live={banner.tone === 'critical' ? 'assertive' : 'polite'}
          className={
            'mb-4 rounded-2xl border px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ' +
            (banner.tone === 'warning'
              ? 'border-[rgba(255,200,80,0.28)] bg-[rgba(60,40,0,0.35)]'
              : banner.tone === 'critical'
                ? 'border-[rgba(255,80,80,0.28)] bg-[rgba(60,0,0,0.35)]'
                : 'border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)]')
          }
        >
          <div className="text-sm">
            {banner.title && (
              <span className="font-medium text-[rgba(255,255,255,0.92)] mr-2">{banner.title}.</span>
            )}
            <span className="text-[rgba(255,255,255,0.72)]">{banner.message}</span>
          </div>
          {banner.showRetry && !items && (
            <button
              type="button"
              className="self-start sm:self-auto rounded-xl border border-[rgba(255,255,255,0.16)] px-4 py-1.5 text-sm bg-[rgba(8,12,16,0.95)] text-white hover:border-[rgba(0,212,255,0.45)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,212,255,0.35)] transition"
              onClick={() => refresh(true)}
              aria-label="Refresh marketplace listings"
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
          )}
        </div>
      )}

      <ul
        className="list-none p-0 m-0 grid grid-cols-3 gap-6 max-[1024px]:grid-cols-2 max-[720px]:grid-cols-1"
        role="list"
      >
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
              role="listitem"
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

        {isLoadingMore && hasMore && !items && (
          <li className="col-span-full flex justify-center py-4" aria-live="polite">
            <div className="flex items-center gap-3 text-sm text-[rgba(255,255,255,0.70)]">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-[rgba(0,212,255,0.45)] border-t-transparent animate-spin" aria-hidden="true" />
              Loading more listings…
            </div>
          </li>
        )}

        {hasMore && !isLoading && !items && state !== 'EXHAUSTED' && (
          <li className="col-span-full flex justify-center py-4">
            <button
              type="button"
              disabled={isLoadingMore || isLoadingInitial || isRefreshing}
              aria-disabled={isLoadingMore || isLoadingInitial || isRefreshing}
              className="rounded-xl border px-5 py-2 bg-[rgba(8,12,16,0.95)] text-white hover:border-[rgba(0,212,255,0.45)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[rgba(0,212,255,0.35)] transition"
              onClick={handleManualLoadMore}
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          </li>
        )}

        {!items && <div ref={sentinelRef} className="hidden" aria-hidden="true" />}
      </ul>

      {hasErrorBanner === false && banner && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 text-center text-xs text-[rgba(255,255,255,0.45)]"
        >
          {banner.message}
        </div>
      )}
    </section>
  );
});
