// @vitest-environment happy-dom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useGridSelection } from '@/hooks/useGridSelection';

describe('useGridSelection', () => {
  // ── toggleSelection ──────────────────────────────────────────────
  describe('toggleSelection', () => {
    it('adds an ID when it is not yet selected', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b', 'c'] }),
      );

      act(() => {
        result.current.toggleSelection('a');
      });

      expect(result.current.selectedIds.has('a')).toBe(true);
      expect(result.current.selectedCount).toBe(1);
    });

    it('removes an ID when it is already selected', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b', 'c'] }),
      );

      act(() => {
        result.current.toggleSelection('a');
      });
      expect(result.current.selectedIds.has('a')).toBe(true);

      act(() => {
        result.current.toggleSelection('a');
      });
      expect(result.current.selectedIds.has('a')).toBe(false);
      expect(result.current.selectedCount).toBe(0);
    });

    it('toggles multiple items independently', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b', 'c'] }),
      );

      act(() => {
        result.current.toggleSelection('a');
        result.current.toggleSelection('b');
      });

      expect(result.current.selectedIds.has('a')).toBe(true);
      expect(result.current.selectedIds.has('b')).toBe(true);
      expect(result.current.selectedIds.has('c')).toBe(false);
      expect(result.current.selectedCount).toBe(2);
    });

    it('allows toggling an ID not in visibleIds (selection survives filtering)', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a', 'b', 'c'] } },
      );

      // Select 'a' while it is visible
      act(() => {
        result.current.toggleSelection('a');
      });
      expect(result.current.selectedIds.has('a')).toBe(true);

      // Rerender with a different set of visibleIds (simulating a filter
      // that removes 'a' from the view).
      rerender({ visibleIds: ['b', 'c', 'd'] });

      // 'a' should still be selected even though it's no longer visible
      expect(result.current.selectedIds.has('a')).toBe(true);
      expect(result.current.selectedCount).toBe(1);
    });

    it('returns a stable function reference across renders', () => {
      const { result, rerender } = renderHook(() =>
        useGridSelection({ visibleIds: ['a'] }),
      );

      const firstRef = result.current.toggleSelection;
      rerender();
      expect(result.current.toggleSelection).toBe(firstRef);
    });
  });

  // ── selectAll ─────────────────────────────────────────────────────
  describe('selectAll', () => {
    it('selects every visible ID', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b', 'c'] }),
      );

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selectedIds.has('a')).toBe(true);
      expect(result.current.selectedIds.has('b')).toBe(true);
      expect(result.current.selectedIds.has('c')).toBe(true);
      expect(result.current.selectedCount).toBe(3);
    });

    it('replaces previous selection with the current visible set', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['x', 'y'] }),
      );

      // Manually select a single item
      act(() => {
        result.current.toggleSelection('x');
      });
      expect(result.current.selectedCount).toBe(1);

      // Then selectAll
      act(() => {
        result.current.selectAll();
      });
      expect(result.current.selectedCount).toBe(2);
      expect(result.current.selectedIds.has('x')).toBe(true);
      expect(result.current.selectedIds.has('y')).toBe(true);
    });

    it('selects nothing when visibleIds is empty', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: [] }),
      );

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selectedCount).toBe(0);
    });

    it('replaces selection with only current visible IDs (drops non-visible items)', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a', 'b'] } },
      );

      // Select 'a' and 'b'
      act(() => {
        result.current.selectAll();
      });
      expect(result.current.selectedCount).toBe(2);

      // Rerender with a new visible set that does NOT include 'a'
      rerender({ visibleIds: ['b', 'c'] });

      // selectAll again — should now contain 'b' and 'c', but 'a' is lost
      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selectedIds.has('b')).toBe(true);
      expect(result.current.selectedIds.has('c')).toBe(true);
      // 'a' is no longer in the set because selectAll replaces with
      // the *current* visibleIds.
      expect(result.current.selectedIds.has('a')).toBe(false);
    });

    it('picks up the latest visibleIds when called after a rerender', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a'] } },
      );

      act(() => {
        result.current.selectAll();
      });
      expect(result.current.selectedCount).toBe(1);
      expect(result.current.selectedIds.has('a')).toBe(true);

      // Rerender with expanded visibleIds
      rerender({ visibleIds: ['a', 'b', 'c'] });

      act(() => {
        result.current.selectAll();
      });
      expect(result.current.selectedCount).toBe(3);
      expect(result.current.selectedIds.has('b')).toBe(true);
      expect(result.current.selectedIds.has('c')).toBe(true);
    });
  });

  // ── clearSelection ────────────────────────────────────────────────
  describe('clearSelection', () => {
    it('removes all selected IDs', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b', 'c'] }),
      );

      act(() => {
        result.current.toggleSelection('a');
        result.current.toggleSelection('b');
      });
      expect(result.current.selectedCount).toBe(2);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.selectedIds.size).toBe(0);
    });

    it('is a no-op when nothing is selected', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a'] }),
      );

      expect(result.current.selectedCount).toBe(0);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedCount).toBe(0);
    });

    it('returns a stable function reference across renders', () => {
      const { result, rerender } = renderHook(() =>
        useGridSelection({ visibleIds: ['a'] }),
      );

      const firstRef = result.current.clearSelection;
      rerender();
      expect(result.current.clearSelection).toBe(firstRef);
    });
  });

  // ── isAllSelected ─────────────────────────────────────────────────
  describe('isAllSelected', () => {
    it('is true when every visible ID is selected', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b'] }),
      );

      act(() => {
        result.current.toggleSelection('a');
        result.current.toggleSelection('b');
      });

      expect(result.current.isAllSelected).toBe(true);
    });

    it('is false when only some visible IDs are selected', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b'] }),
      );

      act(() => {
        result.current.toggleSelection('a');
      });

      expect(result.current.isAllSelected).toBe(false);
    });

    it('is false when no visible IDs are selected', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b'] }),
      );

      expect(result.current.isAllSelected).toBe(false);
    });

    it('is false when visibleIds is empty (even if nothing is selected)', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: [] }),
      );

      expect(result.current.isAllSelected).toBe(false);
    });

    it('is false when visibleIds is empty but there are stale selections', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a'] } },
      );

      act(() => {
        result.current.toggleSelection('a');
      });
      expect(result.current.isAllSelected).toBe(true);

      // Rerender with empty visibleIds — selection still has 'a' but
      // isAllSelected returns false because there are no visible items.
      rerender({ visibleIds: [] });
      expect(result.current.isAllSelected).toBe(false);
    });

    it('updates reactively when visibleIds change', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a', 'b'] } },
      );

      act(() => {
        result.current.selectAll();
      });
      expect(result.current.isAllSelected).toBe(true);

      // Add a new item to the visible set — now not all are selected
      rerender({ visibleIds: ['a', 'b', 'c'] });
      expect(result.current.isAllSelected).toBe(false);
    });
  });

  // ── isIndeterminate ───────────────────────────────────────────────
  describe('isIndeterminate', () => {
    it('is true when some but not all visible IDs are selected', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b', 'c'] }),
      );

      act(() => {
        result.current.toggleSelection('a');
      });

      expect(result.current.isIndeterminate).toBe(true);
    });

    it('is false when no visible IDs are selected', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b'] }),
      );

      expect(result.current.isIndeterminate).toBe(false);
    });

    it('is false when all visible IDs are selected', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b'] }),
      );

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.isIndeterminate).toBe(false);
    });

    it('is false when visibleIds is empty', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: [] }),
      );

      expect(result.current.isIndeterminate).toBe(false);
    });

    it('is false when visibleIds is empty even with stale selections', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a'] } },
      );

      act(() => {
        result.current.toggleSelection('a');
      });
      expect(result.current.isIndeterminate).toBe(false); // 1 of 1 = all

      rerender({ visibleIds: [] });
      // 'a' is still selected but there are no visible items
      expect(result.current.isIndeterminate).toBe(false);
    });

    it('transitions correctly through all three states', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b'] }),
      );

      // Start: nothing selected → not indeterminate
      expect(result.current.isIndeterminate).toBe(false);
      expect(result.current.isAllSelected).toBe(false);

      // Select one → indeterminate
      act(() => {
        result.current.toggleSelection('a');
      });
      expect(result.current.isIndeterminate).toBe(true);
      expect(result.current.isAllSelected).toBe(false);

      // Select the second → all selected, not indeterminate
      act(() => {
        result.current.toggleSelection('b');
      });
      expect(result.current.isIndeterminate).toBe(false);
      expect(result.current.isAllSelected).toBe(true);
    });

    it('updates reactively when visibleIds change', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a', 'b'] } },
      );

      act(() => {
        result.current.toggleSelection('a');
      });
      // 1 of 2 selected → indeterminate
      expect(result.current.isIndeterminate).toBe(true);

      // Rerender so only 'a' is visible
      rerender({ visibleIds: ['a'] });
      // Now 1 of 1 selected → all selected, not indeterminate
      expect(result.current.isIndeterminate).toBe(false);
      expect(result.current.isAllSelected).toBe(true);
    });
  });

  // ── Selection survives filtering (JSDoc claim) ────────────────────
  describe('selection survives filtering', () => {
    it('keeps selected IDs when visibleIds changes to a subset', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a', 'b', 'c', 'd'] } },
      );

      act(() => {
        result.current.toggleSelection('a');
        result.current.toggleSelection('b');
        result.current.toggleSelection('c');
      });

      // Filter down to just ['b', 'd']
      rerender({ visibleIds: ['b', 'd'] });

      // All previously selected items should still be selected
      expect(result.current.selectedIds.has('a')).toBe(true);
      expect(result.current.selectedIds.has('b')).toBe(true);
      expect(result.current.selectedIds.has('c')).toBe(true);
      expect(result.current.selectedCount).toBe(3);

      // Only 'b' is both selected AND visible
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isIndeterminate).toBe(true);
    });

    it('keeps selected IDs when visibleIds expands', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a'] } },
      );

      act(() => {
        result.current.selectAll();
      });
      expect(result.current.selectedCount).toBe(1);

      // Expand the visible set
      rerender({ visibleIds: ['a', 'b', 'c', 'd'] });

      // 'a' is still selected; the new items are not
      expect(result.current.selectedIds.has('a')).toBe(true);
      expect(result.current.selectedCount).toBe(1);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isIndeterminate).toBe(true);
    });

    it('keeps selected IDs across completely different visible sets', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['foo', 'bar'] } },
      );

      act(() => {
        result.current.toggleSelection('foo');
        result.current.toggleSelection('bar');
      });

      // Completely different visible set
      rerender({ visibleIds: ['baz', 'qux'] });

      expect(result.current.selectedIds.has('foo')).toBe(true);
      expect(result.current.selectedIds.has('bar')).toBe(true);
      expect(result.current.selectedCount).toBe(2);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isIndeterminate).toBe(false);
    });

    it('allows toggling off an item that is no longer visible (selection survives filtering)', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a', 'b'] } },
      );

      act(() => {
        result.current.toggleSelection('a');
      });
      expect(result.current.selectedIds.has('a')).toBe(true);

      // Rerender without 'a' in the visible set
      rerender({ visibleIds: ['b', 'c'] });

      // Toggle 'a' off even though it's not visible
      act(() => {
        result.current.toggleSelection('a');
      });

      expect(result.current.selectedIds.has('a')).toBe(false);
      expect(result.current.selectedCount).toBe(0);
    });
  });

  // ── initialSelectedIds ────────────────────────────────────────────
  describe('initialSelectedIds', () => {
    it('seeds the selection state', () => {
      const initial = new Set(['a', 'b']);
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b', 'c'], initialSelectedIds: initial }),
      );

      expect(result.current.selectedIds.has('a')).toBe(true);
      expect(result.current.selectedIds.has('b')).toBe(true);
      expect(result.current.selectedIds.has('c')).toBe(false);
      expect(result.current.selectedCount).toBe(2);
      expect(result.current.isIndeterminate).toBe(true);
    });

    it('works with an empty initial set', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a'], initialSelectedIds: new Set() }),
      );

      expect(result.current.selectedCount).toBe(0);
    });
  });

  // ── setSelectedIds ────────────────────────────────────────────────
  describe('setSelectedIds', () => {
    it('replaces the entire selection set', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b', 'c'] }),
      );

      act(() => {
        result.current.toggleSelection('a');
      });
      expect(result.current.selectedCount).toBe(1);

      act(() => {
        result.current.setSelectedIds(new Set(['b', 'c']));
      });

      expect(result.current.selectedIds.has('a')).toBe(false);
      expect(result.current.selectedIds.has('b')).toBe(true);
      expect(result.current.selectedIds.has('c')).toBe(true);
      expect(result.current.selectedCount).toBe(2);
    });

    it('can set an empty set to clear all', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b'] }),
      );

      act(() => {
        result.current.selectAll();
      });
      expect(result.current.selectedCount).toBe(2);

      act(() => {
        result.current.setSelectedIds(new Set());
      });
      expect(result.current.selectedCount).toBe(0);
    });
  });

  // ── selectedCount ─────────────────────────────────────────────────
  describe('selectedCount', () => {
    it('starts at zero', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b'] }),
      );

      expect(result.current.selectedCount).toBe(0);
    });

    it('reflects the current number of selected items', () => {
      const { result } = renderHook(() =>
        useGridSelection({ visibleIds: ['a', 'b', 'c'] }),
      );

      act(() => {
        result.current.toggleSelection('a');
      });
      expect(result.current.selectedCount).toBe(1);

      act(() => {
        result.current.toggleSelection('b');
      });
      expect(result.current.selectedCount).toBe(2);

      act(() => {
        result.current.toggleSelection('a');
      });
      expect(result.current.selectedCount).toBe(1);
    });

    it('counts items outside the visible set', () => {
      const { result, rerender } = renderHook(
        ({ visibleIds }) => useGridSelection({ visibleIds }),
        { initialProps: { visibleIds: ['a', 'b'] } },
      );

      act(() => {
        result.current.selectAll();
      });
      expect(result.current.selectedCount).toBe(2);

      rerender({ visibleIds: ['c', 'd'] });
      // 'a' and 'b' are still selected even though not visible
      expect(result.current.selectedCount).toBe(2);
    });
  });
});
