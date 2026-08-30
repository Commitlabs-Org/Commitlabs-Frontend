/**
 * Tests for useGridSelection hook (issue #1775)
 *
 * Covers:
 *   - Initial state
 *   - toggleSelection: select and deselect individual items
 *   - selectAll: selects all visible items
 *   - clearSelection: removes all selections
 *   - isAllSelected / isIndeterminate boundary conditions
 *   - selectedCount bounded to visible items (stale IDs excluded)
 *   - toggleSelection referential stability
 */

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridSelection } from '@/hooks/useGridSelection';

describe('useGridSelection', () => {
  const IDS = ['id-1', 'id-2', 'id-3'];

  it('starts with an empty selection', () => {
    const { result } = renderHook(() => useGridSelection({ visibleIds: IDS }));

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isIndeterminate).toBe(false);
  });

  it('toggleSelection adds an unselected item', () => {
    const { result } = renderHook(() => useGridSelection({ visibleIds: IDS }));

    act(() => {
      result.current.toggleSelection('id-1');
    });

    expect(result.current.selectedIds.has('id-1')).toBe(true);
    expect(result.current.selectedCount).toBe(1);
  });

  it('toggleSelection removes an already-selected item', () => {
    const { result } = renderHook(() => useGridSelection({ visibleIds: IDS }));

    act(() => {
      result.current.toggleSelection('id-1');
    });
    act(() => {
      result.current.toggleSelection('id-1');
    });

    expect(result.current.selectedIds.has('id-1')).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('selectAll selects every visible item', () => {
    const { result } = renderHook(() => useGridSelection({ visibleIds: IDS }));

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectedCount).toBe(3);
    expect(result.current.isAllSelected).toBe(true);
    for (const id of IDS) {
      expect(result.current.selectedIds.has(id)).toBe(true);
    }
  });

  it('clearSelection removes all items', () => {
    const { result } = renderHook(() => useGridSelection({ visibleIds: IDS }));

    act(() => {
      result.current.selectAll();
    });
    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('isIndeterminate is true when some (not all) items are selected', () => {
    const { result } = renderHook(() => useGridSelection({ visibleIds: IDS }));

    act(() => {
      result.current.toggleSelection('id-1');
    });

    expect(result.current.isIndeterminate).toBe(true);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('isAllSelected is true when every visible item is selected', () => {
    const { result } = renderHook(() => useGridSelection({ visibleIds: IDS }));

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.isIndeterminate).toBe(false);
  });

  it('isAllSelected is false when visibleIds is empty', () => {
    const { result } = renderHook(() => useGridSelection({ visibleIds: [] }));

    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isIndeterminate).toBe(false);
  });

  it('selectedCount excludes IDs not in visibleIds (stale selection)', () => {
    // Start with 3 visible items, select all.
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useGridSelection({ visibleIds: ids }),
      { initialProps: { ids: IDS } },
    );

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectedCount).toBe(3);

    // Shrink visibleIds (simulate a filter that hides items).
    rerender({ ids: ['id-1'] });

    // selectedCount should only count the still-visible item.
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isAllSelected).toBe(true);
  });

  it('toggleSelection is referentially stable across re-renders', () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useGridSelection({ visibleIds: ids }),
      { initialProps: { ids: IDS } },
    );

    const firstRef = result.current.toggleSelection;
    rerender({ ids: IDS.slice(0, 2) });

    expect(result.current.toggleSelection).toBe(firstRef);
  });

  it('selectAll is referentially stable across re-renders with same visibleIds', () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useGridSelection({ visibleIds: ids }),
      { initialProps: { ids: IDS } },
    );

    const firstRef = result.current.selectAll;
    rerender({ ids: IDS }); // Same reference — hook should not re-create.

    // Note: selectAll depends on visibleIds so it may change when visibleIds changes.
    // Here we only assert no re-creation for the same visibleIds array reference.
    // Because IDS is a module-level constant, visibleIds reference is stable.
    expect(result.current.selectAll).toBe(firstRef);
  });

  it('clearSelection is referentially stable', () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useGridSelection({ visibleIds: ids }),
      { initialProps: { ids: IDS } },
    );

    const firstRef = result.current.clearSelection;
    rerender({ ids: ['id-1'] });

    expect(result.current.clearSelection).toBe(firstRef);
  });
});
