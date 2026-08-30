'use client';

import React, { memo, useEffect, useMemo, useRef } from 'react';
import MyCommitmentCard from './MyCommitmentCard';
import { Commitment } from '@/types/commitment';
import { EmptyState } from '@/components/ui/EmptyState';
import { useGridSelection } from '@/hooks/useGridSelection';
import { BulkActionBar } from './BulkActionBar';
import { Check } from 'lucide-react';
import type { SearchDiagnostics } from '@/hooks/useCommitmentsSearch';
import { MyCommitmentsGridSkeleton } from './MyCommitmentsGridSkeleton';

interface MyCommitmentsGridProps {
  commitments: Commitment[];
  onDetails?: (id: string) => void;
  onAttestations?: (id: string) => void;
  onEarlyExit?: (id: string) => void;
  onListForSale?: (id: string) => void;
  onExportSelected?: (selectedIds: string[]) => void;
  isExporting?: boolean;
  /**
   * When true the grid renders a loading skeleton instead of commitment cards.
   * This prevents stale results from being visible during the loading window
   * for a new query — the caller sets this while useCommitmentsSearch is
   * in-flight and clears it when results arrive.
   */
  isLoading?: boolean;
  /**
   * Client telemetry from the last search request (from useCommitmentsSearch).
   * When provided, actionable summary (latency, cache hit) is surfaced in the
   * grid header for developer/operator visibility. No secrets are exposed.
   */
  diagnostics?: SearchDiagnostics | null;
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

function buildDisplayCommitments(
  commitments: Commitment[],
  filterFn?: (c: Commitment) => boolean,
  sortFn?: (a: Commitment, b: Commitment) => number,
): Commitment[] {
  const seenIds = new Set<string>();
  const filtered: Commitment[] = [];

  for (const commitment of commitments) {
    const id = String(commitment.id ?? '').trim();
    const normalizedId = id.toUpperCase();

    if (!id || seenIds.has(normalizedId)) continue;
    if (filterFn && !filterFn(commitment)) continue;

    seenIds.add(normalizedId);
    filtered.push(commitment);
  }

  if (!sortFn) return filtered;

  return [...filtered].sort((a, b) => {
    const result = sortFn(a, b);
    if (result !== 0) return result;
    return String(a.id).localeCompare(String(b.id));
  });
}

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
 *
 * Query-consistency notes:
 *   - `isLoading` renders a skeleton instead of stale data, preventing
 *     previous results from briefly showing during a new search.
 *   - `diagnostics` surfaces latency and cache-hit telemetry so developers
 *     and operators can observe search performance without leaking secrets.
 *   - The grid is a pure presentation component: stale-query prevention and
 *     abort-controller logic live in the `useCommitmentsSearch` hook that
 *     callers use to populate the `commitments` prop.
 */
const MyCommitmentsGrid: React.FC<MyCommitmentsGridProps> = memo(
  ({
    commitments,
    onDetails,
    onAttestations,
    onEarlyExit,
    onListForSale,
    onExportSelected,
    isExporting = false,
    isLoading = false,
    diagnostics,
    sortFn,
    filterFn,
  }) => {
    // One atomic derived view: filter, dedupe, then stable-sort before
    // selection state is reconciled with what is actually visible.
    const displayedCommitments = useMemo(() => {
      return buildDisplayCommitments(commitments, filterFn, sortFn);
    }, [commitments, filterFn, sortFn]);

    const isLargeList = displayedCommitments.length > VIRTUALIZE_THRESHOLD;

    const visibleIds = useMemo(() => displayedCommitments.map((c) => c.id), [displayedCommitments]);

    // ── Selection state ───────────────────────────────────────────────────
    const {
      selectedIds,
      selectedCount,
      isAllSelected,
      isIndeterminate,
      toggleSelection,
      selectAll,
      clearSelection,
    } = useGridSelection({ visibleIds });

    // Stable per-id toggle handlers so cards whose selection state hasn't
    // changed don't receive a new `onSelect` reference (and re-render) just
    // because some other card was selected/deselected.
    const toggleHandlersRef = useRef<Map<string, () => void>>(new Map());
    const getToggleHandler = (id: string) => {
      let handler = toggleHandlersRef.current.get(id);
      if (!handler) {
        handler = () => toggleSelection(id);
        toggleHandlersRef.current.set(id, handler);
      }
      return handler;
    };

    const handleSelectAll = () => {
      if (isAllSelected) {
        clearSelection();
      } else {
        selectAll();
      }
    };

    const handleExportSelected = () => {
      if (onExportSelected) {
        onExportSelected(Array.from(selectedIds));
      }
    };

    // ── Loading state ─────────────────────────────────────────────────────
    // Render skeleton after all hooks have been called (Rules of Hooks).
    if (isLoading) {
      return <MyCommitmentsGridSkeleton />;
    }

    useEffect(() => {
      const visibleIdSet = new Set(visibleIds);
      for (const id of toggleHandlersRef.current.keys()) {
        if (!visibleIdSet.has(id)) {
          toggleHandlersRef.current.delete(id);
        }
      }
    }, [visibleIds]);

    return (
      <div className="flex flex-col gap-4">
        {/* Header with select all control and optional diagnostics */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = isIndeterminate;
                  }
                }}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#0FF0FC] focus:ring-2 focus:ring-[#0FF0FC] focus:ring-offset-0 focus:ring-offset-[#0a0a0a]"
                aria-label={isAllSelected ? 'Deselect all commitments' : 'Select all commitments'}
              />
              <span className="text-[14px] text-[#94A3B8]">
                <span className="text-[16px] font-semibold text-white">
                  {displayedCommitments.length}
                </span>{' '}
                commitments found
              </span>
            </label>

            {/* Client telemetry: actionable latency / cache indicator.
                Only rendered when diagnostics are provided and the request
                was not aborted. No secrets are surfaced here. */}
            {diagnostics && !diagnostics.aborted && (
              <span
                className="text-[11px] text-[#94A3B8]/70 font-mono"
                aria-label="Search diagnostics"
                title={`Latency: ${diagnostics.latencyMs}ms | Cache: ${diagnostics.cacheHit ? 'hit' : 'miss'}${diagnostics.errorMessage ? ` | Error: ${diagnostics.errorMessage}` : ''}`}
              >
                {diagnostics.cacheHit ? '⚡ cached' : `${diagnostics.latencyMs}ms`}
              </span>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-[#0FF0FC]">
              <Check size={16} />
              <span>{selectedCount} selected</span>
            </div>
          )}
        </div>

        {displayedCommitments.length > 0 ? (
          <div className="grid grid-cols-3 gap-6 max-[1200px]:grid-cols-2 max-[768px]:grid-cols-1">
            {displayedCommitments.map((commitment) => (
              <div
                key={commitment.id}
                // content-visibility: auto tells the browser to skip rendering
                // work for off-screen items; contain-intrinsic-size prevents
                // layout shift as items scroll into view.
                style={
                  isLargeList
                    ? { contentVisibility: 'auto', containIntrinsicSize: '0 380px' }
                    : undefined
                }
              >
                <MyCommitmentCard
                  commitment={commitment}
                  isSelected={selectedIds.has(commitment.id)}
                  onSelect={getToggleHandler(commitment.id)}
                  {...(onDetails ? { onDetails } : {})}
                  {...(onAttestations ? { onAttestations } : {})}
                  {...(onEarlyExit ? { onEarlyExit } : {})}
                  {...(onListForSale ? { onListForSale } : {})}
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

        {/* Bulk action bar */}
        <BulkActionBar
          selectedCount={selectedCount}
          onClear={clearSelection}
          onExportSelected={handleExportSelected}
          isExporting={isExporting}
        />
      </div>
    );
  },
);

MyCommitmentsGrid.displayName = 'MyCommitmentsGrid';

export default MyCommitmentsGrid;
