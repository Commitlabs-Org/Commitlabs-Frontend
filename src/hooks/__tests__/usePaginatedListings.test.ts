import { renderHook, act, waitFor } from '@testing-library/react';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { vi } from 'vitest';

describe('usePaginatedListings', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches first page and appends subsequent pages', async () => {
    const mockResponses = [
      { cards: [{ id: '1' }, { id: '2' }], total: 2 },
      { cards: [{ id: '3' }, { id: '4' }], total: 2 },
    ];
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponses[callCount++]),
      } as Response)
    );

    const { result } = renderHook(() =>
      usePaginatedListings({}, 2)
    );

    // Initial load - wait until listings are populated
    await waitFor(() => {
      expect(result.current.listings).toEqual([{ id: '1' }, { id: '2' }]);
    });
    expect(result.current.hasMore).toBe(true);

    // Load more
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(result.current.listings).toEqual([
        { id: '1' },
        { id: '2' },
        { id: '3' },
        { id: '4' },
      ]);
    });
    expect(result.current.hasMore).toBe(true);
  });

  it('stops loading when a page returns fewer items than pageSize', async () => {
    const mockResponse = { cards: [{ id: '1' }], total: 1 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const { result } = renderHook(() =>
      usePaginatedListings({}, 5)
    );

    await waitFor(() => {
      expect(result.current.listings).toEqual([{ id: '1' }]);
    });
    expect(result.current.hasMore).toBe(false);
  });
});
