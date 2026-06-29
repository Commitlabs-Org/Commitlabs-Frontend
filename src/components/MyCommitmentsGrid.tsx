'use client';

import React, { memo, useMemo } from 'react';
import MyCommitmentCard from './MyCommitmentCard';
import { Commitment } from '@/types/commitment';
import { EmptyState } from '@/components/ui/EmptyState';

interface MyCommitmentsGridProps {
  commitments: Commitment[];
  onDetails?: (id: string) => void;
  onAttestations?: (id: string) => void;
  onEarlyExit?: (id: string) => void;
  onListForSale?: (id: string) => void;
  /** Optional comparator to sort commitments before rendering.
   *  Memoized internally so callers should stabilize the reference. */
  sortFn?: (a: Commitment, b: Commitment) => number;
  /** Optional predicate to filter commitments before rendering.
   *  Memoized internally so callers should stabilize the reference. */
  filterFn?: (c: Commitment) => boolean;
}

// VIRTUALIZATION THRESHOLD — only engage virtual windowing when the list
// exceeds this length to avoid overhead for typical (small) datasets.
const VIRTUALIZE_THRESHOLD = 50;

/**
 * MyCommitmentsGrid
 *
 * Performance notes:
 *   - `sortFn` / `filterFn` are applied via `useMemo` so the derived list
 *     is only recomputed when `commitments`, `sortFn`, or `filterFn` change.
 *   - Each `MyCommitmentCard` is already wrapped in `React.memo`, so cards
 *     whose props are unchanged are skipped during reconciliation.
 *   - When the list exceeds VIRTUALIZE_THRESHOLD items the grid switches to a
 *     CSS `content-visibility: auto` approach (no extra runtime dependency).
 *     This lets the browser skip layout/paint for off-screen rows while
 *     keeping the DOM present for accessibility and SSR. A full windowing
 *     library (react-window, TanStack Virtual) would give larger gains but
 *     requires a new dependency; this lighter approach is intentionally
 *     dependency-conscious as the issue requests.
 */
const MyCommitmentsGrid: React.FC<MyCommitmentsGridProps> = memo(({
  commitments,
  onDetails,
  onAttestations,
  onEarlyExit,
  onListForSale,
  sortFn,
  filterFn,
}) => {
  // Memoize the derived list so filter+sort only run when inputs change.
  const displayedCommitments = useMemo(() => {
    let result = commitments;
    if (filterFn) {
      result = result.filter(filterFn);
    }
    if (sortFn) {
      result = [...result].sort(sortFn);
    }
    return result;
  }, [commitments, filterFn, sortFn]);

  const isLargeList = displayedCommitments.length > VIRTUALIZE_THRESHOLD;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[14px] text-[#94A3B8]">
        <span className="text-[16px] font-semibold text-white">{displayedCommitments.length}</span>{' '}
        commitments found
      </div>

      {displayedCommitments.length > 0 ? (
        <div className="grid grid-cols-3 gap-6 max-[1200px]:grid-cols-2 max-[768px]:grid-cols-1">
          {displayedCommitments.map((commitment) => (
            <div
              key={commitment.id}
              // content-visibility: auto tells the browser to skip rendering
              // work for off-screen items; contain-intrinsic-size prevents
              // layout shift as items scroll into view.
              style={isLargeList ? { contentVisibility: 'auto', containIntrinsicSize: '0 380px' } : undefined}
            >
              <MyCommitmentCard
                commitment={commitment}
                onDetails={onDetails}
                onAttestations={onAttestations}
                onEarlyExit={onEarlyExit}
                onListForSale={onListForSale}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No commitments found"
          description="No commitments found matching your filters."
          cta={{ label: 'Create your first commitment', href: '/create' }}
        />
      )}
    </div>
  );
});

MyCommitmentsGrid.displayName = 'MyCommitmentsGrid';

export default MyCommitmentsGrid;
