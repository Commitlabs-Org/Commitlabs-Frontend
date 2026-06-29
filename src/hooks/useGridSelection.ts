import { useState, useCallback, useMemo } from 'react';

interface UseGridSelectionOptions {
  /** All visible item IDs (used for select all functionality) */
  visibleIds: string[];
  /** Optional initial selected IDs */
  initialSelectedIds?: Set<string>;
}

interface UseGridSelectionReturn {
  /** Set of currently selected IDs */
  selectedIds: Set<string>;
  /** Number of selected items */
  selectedCount: number;
  /** Whether all visible items are selected */
  isAllSelected: boolean;
  /** Whether some (but not all) visible items are selected */
  isIndeterminate: boolean;
  /** Toggle selection of a single item */
  toggleSelection: (id: string) => void;
  /** Select all visible items */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Set selected IDs to a specific set */
  setSelectedIds: (ids: Set<string>) => void;
}

/**
 * Hook for managing multi-select state in a grid component.
 * 
 * Features:
 * - Per-item selection toggle
 * - Select all visible items
 * - Clear all selections
 * - Selection survives filtering (persists across visible ID changes)
 * - Indeterminate state for partial selection
 * 
 * @example
 * ```tsx
 * const { selectedIds, toggleSelection, selectAll, clearSelection, isAllSelected } = useGridSelection({
 *   visibleIds: commitments.map(c => c.id),
 * });
 * ```
 */
export function useGridSelection({
  visibleIds,
  initialSelectedIds = new Set(),
}: UseGridSelectionOptions): UseGridSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelectedIds);

  // Memoize selection state calculations
  const selectedCount = selectedIds.size;
  
  const isAllSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    return visibleIds.every(id => selectedIds.has(id));
  }, [visibleIds, selectedIds]);

  const isIndeterminate = useMemo(() => {
    if (visibleIds.length === 0) return false;
    const visibleSelectedCount = visibleIds.filter(id => selectedIds.has(id)).length;
    return visibleSelectedCount > 0 && visibleSelectedCount < visibleIds.length;
  }, [visibleIds, selectedIds]);

  // Toggle selection of a single item
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all visible items
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(visibleIds));
  }, [visibleIds]);

  // Clear all selections
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
    setSelectedIds,
  };
}
