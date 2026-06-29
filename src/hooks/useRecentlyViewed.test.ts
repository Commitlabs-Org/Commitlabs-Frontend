// @vitest-environment happy-dom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';

describe('useRecentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts empty and restores from local storage', async () => {
    localStorage.setItem(
      'marketplace-recently-viewed',
      JSON.stringify(['001', '002'])
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
});
