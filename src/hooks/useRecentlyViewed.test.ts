// @vitest-environment happy-dom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecentlyViewed, RECENTLY_VIEWED_COMMITMENTS_KEY } from '@/hooks/useRecentlyViewed';

describe('useRecentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts empty and restores from local storage', async () => {
    localStorage.setItem('marketplace-recently-viewed', JSON.stringify(['001', '002']));

    const { result } = renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.recentIds).toEqual(['001', '002']);
  });

  it('filters out non-string entries from corrupted local storage', async () => {
    localStorage.setItem(
      'marketplace-recently-viewed',
      JSON.stringify(['001', 1, { evil: true }, null, '002']),
    );

    const { result } = renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.recentIds).toEqual(['001', '002']);
  });

  it('adds views with deduplication (moves to front)', async () => {
    const { result } = renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    act(() => {
      result.current.addView('001');
      result.current.addView('002');
    });

    expect(result.current.recentIds).toEqual(['002', '001']);

    act(() => {
      result.current.addView('001');
    });

    expect(result.current.recentIds).toEqual(['001', '002']);
  });

  it('evicts oldest when cap is reached', async () => {
    const { result } = renderHook(() => useRecentlyViewed(3));

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    act(() => {
      result.current.addView('1');
      result.current.addView('2');
      result.current.addView('3');
      result.current.addView('4');
    });

    expect(result.current.recentIds).toEqual(['4', '3', '2']);
  });

  it('clears all listings', async () => {
    const { result } = renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    act(() => {
      result.current.addView('1');
      result.current.addView('2');
    });

    expect(result.current.recentIds).toHaveLength(2);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.recentIds).toHaveLength(0);
    expect(localStorage.getItem('marketplace-recently-viewed')).toBe('[]');
  });

  it('filters out all entries when corrupted array contains no strings', async () => {
    localStorage.setItem(
      'marketplace-recently-viewed',
      JSON.stringify([123, true, false, null, { foo: 'bar' }, ['nested']]),
    );

    const { result } = renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.recentIds).toEqual([]);
  });

  it('returns empty array when local storage contains non-array JSON', async () => {
    localStorage.setItem('marketplace-recently-viewed', JSON.stringify({ notAnArray: true }));

    const { result } = renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.recentIds).toEqual([]);
  });

  it('returns empty array when local storage contains unparseable corrupted JSON', async () => {
    localStorage.setItem('marketplace-recently-viewed', 'invalid-json-{');

    const { result } = renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.recentIds).toEqual([]);
  });

  it('caps initial restored ids to the specified cap parameter', async () => {
    localStorage.setItem(
      'marketplace-recently-viewed',
      JSON.stringify(['001', '002', '003', '004', '005']),
    );

    const { result } = renderHook(() => useRecentlyViewed(2));

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.recentIds).toEqual(['001', '002']);
  });

  it('handles local storage read error gracefully', async () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('Storage read error');
    });

    const { result } = renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.recentIds).toEqual([]);
  });

  it('handles local storage write error gracefully', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    const { result } = renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    act(() => {
      result.current.addView('001');
    });

    await vi.waitFor(() => {
      expect(setItemSpy).toHaveBeenCalled();
    });

    expect(result.current.recentIds).toEqual(['001']);
  });

  it('tracks a custom storage key independently of the default marketplace key', async () => {
    localStorage.setItem('marketplace-recently-viewed', JSON.stringify(['listing-1']));

    const { result } = renderHook(() => useRecentlyViewed(5, RECENTLY_VIEWED_COMMITMENTS_KEY));

    await vi.waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.recentIds).toEqual([]);

    act(() => {
      result.current.addView('commitment-1');
    });

    expect(result.current.recentIds).toEqual(['commitment-1']);
    expect(localStorage.getItem(RECENTLY_VIEWED_COMMITMENTS_KEY)).toBe(
      JSON.stringify(['commitment-1']),
    );
    expect(localStorage.getItem('marketplace-recently-viewed')).toBe(JSON.stringify(['listing-1']));
  });
});
