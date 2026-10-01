/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MARKETPLACE_WATCHLIST_KEY, useMarketplaceWatchlist } from './useMarketplaceWatchlist';

describe('useMarketplaceWatchlist', () => {
  it('restores and persists saved listing ids', () => {
    localStorage.setItem(MARKETPLACE_WATCHLIST_KEY, JSON.stringify(['listing-1']));
    const { result } = renderHook(() => useMarketplaceWatchlist());

    expect(result.current.isSaved('listing-1')).toBe(true);
    act(() => result.current.toggle('listing-2'));
    expect(JSON.parse(localStorage.getItem(MARKETPLACE_WATCHLIST_KEY) ?? '[]')).toEqual([
      'listing-1',
      'listing-2',
    ]);
  });
});
