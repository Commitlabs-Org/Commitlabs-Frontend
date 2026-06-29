import { memo, useMemo } from 'react'
import type { MarketplaceCardProps } from './MarketplaceCard'
import { MarketplaceCard } from './MarketplaceCard'
import { EmptyState } from '@/components/ui/EmptyState'

export interface MarketplaceGridProps {
  items: MarketplaceCardProps[]
  isComparePinned?: (id: string) => boolean
  isCompareFull?: boolean
  onCompareToggle?: (listing: MarketplaceCardProps) => void
  onView?: (id: string) => void
  /** Optional comparator applied before rendering. Stabilize with useCallback. */
  sortFn?: (a: MarketplaceCardProps, b: MarketplaceCardProps) => number
  /** Optional predicate applied before rendering. Stabilize with useCallback. */
  filterFn?: (item: MarketplaceCardProps) => boolean
}

// VIRTUALIZATION THRESHOLD — engage CSS content-visibility windowing only
// when the list is large enough to justify the overhead.
const VIRTUALIZE_THRESHOLD = 50

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
  sortFn,
  filterFn,
}: MarketplaceGridProps) {
  // Memoize derived list — only recomputes when items / predicates change.
  const displayedItems = useMemo(() => {
    let result = items
    if (filterFn) {
      result = result.filter(filterFn)
    }
    if (sortFn) {
      result = [...result].sort(sortFn)
    }
    return result
  }, [items, filterFn, sortFn])

  if (!displayedItems || displayedItems.length === 0) {
    return (
      <section className="mt-10" aria-label="Marketplace listings">
        <EmptyState
          title="No commitments available"
          description="New offers will appear here once they are listed."
          className="rounded-[20px] px-6 border border-[rgba(255,255,255,0.12)] bg-[radial-gradient(140%_140%_at_0%_0%,rgba(255,255,255,0.06),rgba(255,255,255,0.01)_65%),rgba(0,0,0,0.45)] shadow-[0_18px_45px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        />
      </section>
    )
  }

  const isLargeList = displayedItems.length > VIRTUALIZE_THRESHOLD

  return (
    <section className="mt-6" aria-label="Marketplace listings">
      <ul className="list-none p-0 m-0 grid grid-cols-3 gap-6 max-[1024px]:grid-cols-2 max-[720px]:grid-cols-1">
        {displayedItems.map((item) => {
          const compareSelected = isComparePinned?.(item.id) ?? false
          return (
            <li
              key={item.id}
              className="min-h-[280px]"
              // content-visibility: auto defers rendering of off-screen list
              // items; contain-intrinsic-size prevents scroll-bar jank.
              style={isLargeList ? { contentVisibility: 'auto', containIntrinsicSize: '0 320px' } : undefined}
            >
              <MarketplaceCard
                {...item}
                compareSelected={compareSelected}
                compareDisabled={isCompareFull && !compareSelected}
                onCompareToggle={
                  onCompareToggle ? () => onCompareToggle(item) : undefined
                }
                onView={onView}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
})
