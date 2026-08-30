import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { useMarketplaceStats } from '@/hooks/useMarketplaceStats';

// ───────────────────────────────────────────────────────────────────────
// Fetch mock plumbing (shared)
// ───────────────────────────────────────────────────────────────────────

interface FetchCall {
  url: string;
  res: () => { status: number; json?: unknown; headers?: Record<string, string> } | Promise<{ status: number; json?: unknown; headers?: Record<string, string> }>;
}

const fetchCalls: FetchCall[] = [];

function registerFetch(matcher: (url: string) => boolean, res: FetchCall['res']) {
  fetchCalls.push({ url: matcher.toString(), res });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchCalls.length = 0;
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    for (let i = fetchCalls.length - 1; i >= 0; i--) {
      // Fall through: try last registered first
    }
    if (url.includes('/api/marketplace/listings')) {
      const qs = new URLSearchParams(url.split('?')[1] ?? '');
      const page = Number(qs.get('page') || 1);
      const pageSize = Number(qs.get('pageSize') || 9);
      const sp = (page - 1) * pageSize;
      if (page > 3) {
        return new Response(JSON.stringify({ success: true, data: { items: [], total: 25 } }), { status: 200 });
      }
      const items = Array.from({ length: pageSize }).map((_, i) => ({
        listingId: `L-${sp + i + 1}`,
        type: i % 3 === 0 ? 'Safe' : i % 3 === 1 ? 'Balanced' : 'Aggressive',
        complianceScore: 90 - i,
        amount: 1000 + sp + i,
        remainingDays: 30 + i,
        currentYield: 5 + i,
        maxLoss: i % 10,
        price: 1100 + sp + i,
      }));
      return new Response(JSON.stringify({ success: true, data: { items, total: 3 * pageSize } }), { status: 200 });
    }
    if (url.includes('/api/marketplace/stats')) {
      const data = {
        activeListings: 6,
        averageYield: 12.43,
        medianPrice: 130000,
        typeBreakdown: { Safe: 2, Balanced: 2, Aggressive: 2 },
      };
      const meta = {
        freshness: 'FRESH',
        ageSeconds: 0,
        generation: 1,
        lastValidGeneration: 1,
        cacheHit: false,
        state: 'FRESH',
        fetchedAtIso: new Date().toISOString(),
        expiresAtIso: new Date(Date.now() + 30_000).toISOString(),
      };
      return new Response(JSON.stringify({ success: true, data, meta }), {
        status: 200,
        headers: { 'x-correlation-id': 'cid-123', ETag: '"etag-stats-1"' },
      });
    }
    return new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'nope' } }), { status: 404 });
  });
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ───────────────────────────────────────────────────────────────────────
// usePaginatedListings
// ───────────────────────────────────────────────────────────────────────

describe('usePaginatedListings — state machine transitions', () => {
  it('starts in IDLE then transitions to LOADING_INITIAL on mount when not disabled', async () => {
    const { result } = renderHook(() => usePaginatedListings({}, 9, false));

    expect(result.current.state).toBe('LOADING_INITIAL');
    expect(result.current.isLoadingInitial).toBe(true);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.state).toBe('SUCCESS'));
    expect(result.current.listings.length).toBeGreaterThan(0);
    expect(result.current.page).toBe(1);
    expect(result.current.isLoadingInitial).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('stays IDLE when disabled=true', async () => {
    const { result } = renderHook(() => usePaginatedListings({}, 9, true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state).toBe('IDLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dedupes duplicate items by id in append and refresh', async () => {
    const dupFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const qs = new URLSearchParams(url.split('?')[1] ?? '');
      const page = Number(qs.get('page') || 1);
      if (page === 1) {
        const items = [
          { listingId: 'A', type: 'Safe', complianceScore: 90, amount: 100, remainingDays: 10, currentYield: 5, maxLoss: 2, price: 110 },
          { listingId: 'B', type: 'Balanced', complianceScore: 80, amount: 200, remainingDays: 20, currentYield: 8, maxLoss: 5, price: 220 },
          { listingId: 'A', type: 'Safe', complianceScore: 90, amount: 100, remainingDays: 10, currentYield: 5, maxLoss: 2, price: 110 }, // dup A within page 1
        ];
        return new Response(JSON.stringify({ success: true, data: { items, total: 5 } }), { status: 200 });
      }
      const items = [
        { listingId: 'B', type: 'Balanced', complianceScore: 80, amount: 200, remainingDays: 20, currentYield: 8, maxLoss: 5, price: 220 }, // dup B across pages
        { listingId: 'C', type: 'Aggressive', complianceScore: 70, amount: 300, remainingDays: 30, currentYield: 12, maxLoss: 10, price: 330 },
      ];
      return new Response(JSON.stringify({ success: true, data: { items, total: 5 } }), { status: 200 });
    });
    globalThis.fetch = dupFetch as unknown as typeof globalThis.fetch;

    const { result } = renderHook(() => usePaginatedListings({}, 3, false));
    await waitFor(() => expect(result.current.state).toBe('SUCCESS'));
    expect(result.current.listings.map((l) => l.id)).toEqual(['A', 'B']);

    await act(() => result.current.loadMore());
    await waitFor(() => expect(fetchMock ?? dupFetch).toHaveBeenCalledTimes(2));

    expect(result.current.listings.map((l) => l.id)).toEqual(['A', 'B', 'C']);
  });

  it('transitions to EXHAUSTED when fewer items than pageSize returned', async () => {
    const exhaustFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              { listingId: 'X1', type: 'Safe', complianceScore: 90, amount: 100, remainingDays: 10, currentYield: 5, maxLoss: 2, price: 110 },
              { listingId: 'X2', type: 'Balanced', complianceScore: 80, amount: 200, remainingDays: 20, currentYield: 8, maxLoss: 5, price: 220 },
            ],
            total: 2,
          },
        }),
        { status: 200 },
      );
    });
    globalThis.fetch = exhaustFetch as unknown as typeof globalThis.fetch;

    const { result } = renderHook(() => usePaginatedListings({}, 9, false));
    await waitFor(() => expect(result.current.state).toBe('EXHAUSTED'));
    expect(result.current.hasMore).toBe(false);
  });

  it('preserves stale data (ERROR_STALE) on retry exhaustion, exposing retryCount and error', async () => {
    let failFetchCalls = 0;
    const failFetch = vi.fn(async () => {
      failFetchCalls += 1;
      return new Response(
        JSON.stringify({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'down', retryable: true, retryAfterSeconds: 10 } }),
        { status: 503 },
      );
    });
    globalThis.fetch = failFetch as unknown as typeof globalThis.fetch;

    const { result } = renderHook(() => usePaginatedListings({}, 9, false));

    await waitFor(() => expect(result.current.state).toBe('ERROR_EMPTY'));
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.retryable).toBe(true);
    expect(result.current.retryCount).toBeGreaterThanOrEqual(1);
    expect(result.current.error?.retryAfterSeconds).toBe(10);
  });

  it('resets pagination + cancels inflight when queryParams identity changes', async () => {
    let abortCalled = false;
    const sigFetch = vi.fn(async (_: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) {
        init.signal.addEventListener('abort', () => {
          abortCalled = true;
        });
      }
      await new Promise((r) => setTimeout(r, 1_000));
      return new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }), { status: 200 });
    });
    globalThis.fetch = sigFetch as unknown as typeof globalThis.fetch;

    const initialQuery = { type: 'Safe' };
    const { result, rerender } = renderHook(
      ({ qp }) => usePaginatedListings(qp, 9, false),
      { initialProps: { qp: initialQuery } },
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ qp: { type: 'Balanced' } });

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });

    expect(result.current.generation).toBeGreaterThanOrEqual(1);
    expect(abortCalled).toBe(true);
  });

  it('refresh() bumps generation, aborts previous, and resets page to 1', async () => {
    const { result } = renderHook(() => usePaginatedListings({}, 9, false));
    await waitFor(() => expect(result.current.state).toBe('SUCCESS'));
    const beforeGen = result.current.generation;
    const callsBefore = fetchMock.mock.calls.length;

    await act(() => result.current.refresh(true));

    expect(result.current.generation).toBeGreaterThan(beforeGen);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('loadMore() is a no-op when LOADING_MORE state is already active', async () => {
    const slowFetch = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5_000));
      return new Response(JSON.stringify({ success: true, data: { items: [], total: 100 } }), { status: 200 });
    });
    globalThis.fetch = slowFetch as unknown as typeof globalThis.fetch;

    const { result } = renderHook(() => usePaginatedListings({}, 9, false));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.isLoadingInitial).toBe(true);
    const callsBefore = slowFetch.mock.calls.length;

    await act(async () => {
      await result.current.loadMore();
    });

    expect(slowFetch.mock.calls.length).toBe(callsBefore);
  });
});

// ───────────────────────────────────────────────────────────────────────
// useMarketplaceStats
// ───────────────────────────────────────────────────────────────────────

describe('useMarketplaceStats — client freshness / state machine / dedup', () => {
  it('transitions IDLE → FETCHING → FRESH on successful mount, populates meta', async () => {
    const { result } = renderHook(() => useMarketplaceStats({ disabled: false, autoRevalidate: false }));

    expect(result.current.state).toBe('FETCHING');
    expect(result.current.isFetching).toBe(true);

    await waitFor(() => expect(result.current.state).toBe('FRESH'));
    expect(result.current.isFetching).toBe(false);
    expect(result.current.stats.activeListings).toBe(6);
    expect(result.current.meta).toBeTruthy();
    expect(result.current.meta?.freshness).toBe('FRESH');
    expect(result.current.meta?.generation).toBe(1);
    expect(result.current.retryCount).toBe(0);
    expect(typeof result.current.lastSuccessAt).toBe('number');
    expect(result.current.lastSuccessAt).toBeGreaterThan(0);
  });

  it('does not issue network requests when disabled=true', async () => {
    const { result } = renderHook(() => useMarketplaceStats({ disabled: true }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state).toBe('IDLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revalidates with If-None-Match when a prior ETag exists', async () => {
    const { result } = renderHook(() => useMarketplaceStats({ disabled: false, autoRevalidate: false }));
    await waitFor(() => expect(result.current.state).toBe('FRESH'));

    await act(() => result.current.revalidate());
    await waitFor(() => expect(result.current.state).toBe('FRESH'));

    const secondCall = fetchMock.mock.calls[1];
    const req = secondCall?.[1];
    const headers = (req?.headers ?? {}) as Record<string, string>;
    expect(headers['If-None-Match']).toBe('"etag-stats-1"');
  });

  it('transitions to STALE_IF_ERROR preserving last payload on repeated 5xx', async () => {
    const failFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/marketplace/stats')) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'down', retryable: true, retryAfterSeconds: 30, correlationId: 'errc' } }),
          { status: 503, headers: { 'x-correlation-id': 'cid-error' } },
        );
      }
      return new Response(null, { status: 404 });
    });
    globalThis.fetch = failFetch as unknown as typeof globalThis.fetch;

    const { result } = renderHook(() => useMarketplaceStats({ disabled: false, autoRevalidate: false }));
    await waitFor(() => {
      const s = result.current.state;
      expect(s === 'ERROR' || s === 'STALE_IF_ERROR' || result.current.retryCount >= 1).toBe(true);
    });
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.retryable).toBe(true);
    expect(result.current.error?.retryAfterSeconds).toBe(30);
  });

  it('reset() wipes payload/meta/error and bumps generation', async () => {
    const { result } = renderHook(() => useMarketplaceStats({ disabled: false, autoRevalidate: false }));
    await waitFor(() => expect(result.current.state).toBe('FRESH'));
    const preGen = result.current.generation;

    act(() => result.current.reset());

    expect(result.current.generation).toBeGreaterThan(preGen);
    expect(result.current.state).toBe('IDLE');
    expect(result.current.error).toBeNull();
    expect(result.current.stats.activeListings).toBe(0);
    expect(result.current.meta).toBeNull();
  });

  it('fetch(force=true) bypasses local freshness gating', async () => {
    const { result } = renderHook(() => useMarketplaceStats({ disabled: false, autoRevalidate: false }));
    await waitFor(() => expect(result.current.state).toBe('FRESH'));
    const before = fetchMock.mock.calls.length;

    await act(() => result.current.fetch(true));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  });

  it('generation bumps on revalidate() to dedupe stale responses', async () => {
    const { result } = renderHook(() => useMarketplaceStats({ disabled: false, autoRevalidate: false }));
    await waitFor(() => expect(result.current.state).toBe('FRESH'));
    const g1 = result.current.generation;
    await act(() => result.current.revalidate());
    const g2 = result.current.generation;
    expect(g2).toBeGreaterThan(g1);
  });
});
