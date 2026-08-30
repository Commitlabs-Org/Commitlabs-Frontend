import { useCallback, useMemo, useState } from 'react';

interface UseGridSelectionOptions {
  /** The currently visible IDs. Selection is bounded to these. */
  visibleIds: string[];
}

interface UseGridSelectionResult {
  /** Set of currently selected commitment IDs. */
  selectedIds: Set<string>;
  /** Count of currently selected items. */
  selectedCount: number;
  /** True when every visible item is selected. */
  isAllSelected: boolean;
  /** True when some (but not all) visible items are selected. */
  isIndeterminate: boolean;
  /** Toggle a single item by id. */
  toggleSelection: (id: string) => void;
  /** Select all visible items. */
  selectAll: () => void;
  /** Deselect all items. */
  clearSelection: () => void;
}

/**
 * useGridSelection
 *
 * Manages a Set-based selection state for a grid of items. Selection is
 * always bounded to the currently visible IDs: items that are scrolled out
 * of the rendered list or filtered out are automatically excluded from
 * "select-all" coverage so the caller never receives stale IDs.
 *
 * All mutators are referentially stable (wrapped in useCallback) so they can
 * be passed down to memoized child components without triggering re-renders.
 */
export function useGridSelection({ visibleIds }: UseGridSelectionOptions): UseGridSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedCount = useMemo(() => {
    // Only count ids that are still visible.
    let count = 0;
    for (const id of selectedIds) {
      if (visibleIds.includes(id)) count++;
    }
    return count;
  }, [selectedIds, visibleIds]);

  const isAllSelected = visibleIds.length > 0 && selectedCount === visibleIds.length;

  const isIndeterminate = selectedCount > 0 && !isAllSelected;

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        next.add(id);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    selectedCount,
    isAllSelected,
    isIndeterminate,
    toggleSelection,
    selectAll,
    clearSelection,
  };
}
