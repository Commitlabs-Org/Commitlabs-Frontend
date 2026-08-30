// @vitest-environment happy-dom
/**
 * tests/hooks/useSearchCommitments.test.ts
 *
 * Tests for the useSearchCommitments hook introduced in #1775.
 *
 * Coverage:
 *   - Successful fetch returns data + telemetry
 *   - Error on non-OK response is surfaced in `error` state
 *   - AbortController: rapid successive search() calls cancel earlier requests
 *   - Debounce: rapid calls collapse into a single fetch invocation
 *   - Stale-response prevention: older generation responses are discarded
 *   - Abort on unmount: in-flight requests are cancelled when component unmounts
 *   - abort() resets loading state and cancels debounce timer
 *   - Telemetry parsed from response headers
 *   - loading=true immediately on search(), before debounce fires
 *
 * Note on fake timers: We use `vi.useFakeTimers({ shouldAdvanceTime: false })`
 * and flush the debounce via `vi.advanceTimersByTimeAsync()`. This avoids the
 * vitest/RTL interaction where faking `setTimeout` also breaks `waitFor`'s own
 * timeout mechanism.
 *
 * Refs #1775
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchCommitments } from '@/hooks/useSearchCommitments';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHeaders(overrides: Record<string, string> = {}): Headers {
  return new Headers({
    'X-Search-Duration-Ms': '42',
    'X-Search-Cache-Hit': '0',
    'X-Search-Returned-Count': '3',
    'X-Search-Total': '10',
    'X-Search-Filtered-Count': '5',
    'X-Search-Truncated': '0',
    'X-Search-Chain-Duration-Ms': '20',
    ...overrides,
  });
}

function makeSuccessBody(data: unknown[] = []) {
  return JSON.stringify({
    success: true,
    data: {
      data,
      meta: {
        page: 1,
        pageSize: 10,
        total: data.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filters: {},
    },
  });
}

const BASE_PARAMS = {
  ownerAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

/** Advance fake timers by N ms and wait for all microtasks to settle. */
async function advanceDebounce(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useSearchCommitments', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns data and telemetry on a successful fetch', async () => {
    const mockData = [{ commitmentId: 'cm_1', asset: 'USDC' }];
    fetchMock.mockResolvedValue(
      new Response(makeSuccessBody(mockData), {
        status: 200,
        headers: makeHeaders(),
      }),
    );

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 100 }));

    act(() => {
      result.current.search(BASE_PARAMS);
    });

    // loading=true immediately (before debounce/fetch)
    expect(result.current.loading).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance past debounce and resolve fetch
    await advanceDebounce(200);

    expect(result.current.loading).toBe(false);
    expect(result.current.data).not.toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.telemetry).not.toBeNull();
    expect(result.current.telemetry?.cacheHit).toBe(false);
    expect(result.current.telemetry?.durationMs).toBe(42);
    expect(result.current.telemetry?.chainDurationMs).toBe(20);
    expect(result.current.telemetry?.returnedCount).toBe(3);
    expect(result.current.telemetry?.total).toBe(10);
    expect(result.current.telemetry?.filteredCount).toBe(5);
    expect(result.current.telemetry?.truncated).toBe(false);
  });

  it('sets cacheHit=true when X-Search-Cache-Hit=1', async () => {
    fetchMock.mockResolvedValue(
      new Response(makeSuccessBody([]), {
        status: 200,
        headers: makeHeaders({ 'X-Search-Cache-Hit': '1' }),
      }),
    );

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 0 }));
    act(() => result.current.search(BASE_PARAMS));
    await advanceDebounce(50);

    expect(result.current.telemetry?.cacheHit).toBe(true);
  });

  it('sets truncated=true when X-Search-Truncated=1', async () => {
    fetchMock.mockResolvedValue(
      new Response(makeSuccessBody([]), {
        status: 200,
        headers: makeHeaders({ 'X-Search-Truncated': '1' }),
      }),
    );

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 0 }));
    act(() => result.current.search(BASE_PARAMS));
    await advanceDebounce(50);

    expect(result.current.telemetry?.truncated).toBe(true);
  });

  // ── Error paths ────────────────────────────────────────────────────────────

  it('sets error state on a non-OK HTTP response', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Bad param' },
        }),
        {
          status: 400,
          headers: new Headers({ 'Content-Type': 'application/json' }),
        },
      ),
    );

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 0 }));
    act(() => result.current.search(BASE_PARAMS));
    await advanceDebounce(50);

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Bad param');
    expect(result.current.data).toBeNull();
    expect(result.current.telemetry).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sets error state on a network failure', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 0 }));
    act(() => result.current.search(BASE_PARAMS));
    await advanceDebounce(50);

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('network error');
    expect(result.current.loading).toBe(false);
  });

  // ── loading starts immediately ─────────────────────────────────────────────

  it('sets loading=true immediately on search() even when debounceMs > 0', () => {
    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 500 }));

    act(() => {
      result.current.search(BASE_PARAMS);
    });

    // Debounce has NOT yet fired
    expect(result.current.loading).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ── Debounce ───────────────────────────────────────────────────────────────

  it('collapses rapid successive search() calls into a single fetch', async () => {
    fetchMock.mockResolvedValue(
      new Response(makeSuccessBody([]), { status: 200, headers: makeHeaders() }),
    );

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 300 }));

    act(() => {
      // Fire 5 rapid calls without advancing time between them
      result.current.search({ ...BASE_PARAMS, asset: 'USDC' });
      result.current.search({ ...BASE_PARAMS, asset: 'XLM' });
      result.current.search({ ...BASE_PARAMS, asset: 'BTC' });
      result.current.search({ ...BASE_PARAMS, asset: 'ETH' });
      result.current.search({ ...BASE_PARAMS, asset: 'DOT' });
    });

    // No fetch should have been issued yet (debounce pending)
    expect(fetchMock).not.toHaveBeenCalled();

    await advanceDebounce(400);

    // Only 1 fetch should have been issued (the last debounced call)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('includes the last set of params in the debounced fetch URL', async () => {
    fetchMock.mockResolvedValue(
      new Response(makeSuccessBody([]), { status: 200, headers: makeHeaders() }),
    );

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 300 }));

    act(() => {
      result.current.search({ ...BASE_PARAMS, asset: 'USDC' });
      result.current.search({ ...BASE_PARAMS, asset: 'XLM' }); // <-- last
    });

    await advanceDebounce(400);

    const calledUrl = (fetchMock.mock.calls[0] as [string])[0];
    expect(calledUrl).toContain('asset=XLM');
    expect(calledUrl).not.toContain('asset=USDC');
  });

  // ── AbortController ────────────────────────────────────────────────────────

  it('aborts the previous in-flight request when a new search() is called', async () => {
    const abortedSignals: AbortSignal[] = [];

    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (signal) {
        signal.addEventListener('abort', () => abortedSignals.push(signal));
      }
      // Never resolves — keeps the first request in-flight
      return new Promise(() => {});
    });

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 0 }));

    // First search — issues a fetch
    act(() => result.current.search({ ...BASE_PARAMS, asset: 'USDC' }));
    await advanceDebounce(10);

    // Second search — should abort the first fetch
    act(() => result.current.search({ ...BASE_PARAMS, asset: 'XLM' }));

    expect(abortedSignals.length).toBeGreaterThanOrEqual(1);
    expect(abortedSignals[0]?.aborted).toBe(true);
  });

  // ── Stale-response prevention ──────────────────────────────────────────────

  it('discards a stale response that arrives after a newer search()', async () => {
    // First fetch — will resolve late (after second search)
    let resolveFirst!: (v: Response) => void;
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });

    fetchMock
      .mockReturnValueOnce(firstFetch)
      .mockResolvedValueOnce(
        new Response(makeSuccessBody([{ commitmentId: 'cm_NEW' }]), {
          status: 200,
          headers: makeHeaders(),
        }),
      );

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 0 }));

    // Issue first search
    act(() => result.current.search({ ...BASE_PARAMS, asset: 'USDC' }));
    await advanceDebounce(10);

    // Issue second search (supersedes first)
    act(() => result.current.search({ ...BASE_PARAMS, asset: 'XLM' }));
    await advanceDebounce(10);

    // Second fetch resolves — data should reflect cm_NEW
    expect(result.current.loading).toBe(false);

    // Now resolve the stale first fetch (should be discarded)
    await act(async () => {
      resolveFirst(
        new Response(makeSuccessBody([{ commitmentId: 'cm_STALE' }]), {
          status: 200,
          headers: makeHeaders(),
        }),
      );
      // Let microtasks settle
      await Promise.resolve();
    });

    // The stale response must not overwrite the current data
    const ids = result.current.data?.data.map((c: any) => c.commitmentId) ?? [];
    expect(ids).not.toContain('cm_STALE');
  });

  // ── Unmount cleanup ────────────────────────────────────────────────────────

  it('aborts any in-flight request on unmount', async () => {
    let abortedOnUnmount = false;

    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (signal) {
        signal.addEventListener('abort', () => {
          abortedOnUnmount = true;
        });
      }
      return new Promise(() => {}); // Never resolves
    });

    const { result, unmount } = renderHook(() => useSearchCommitments({ debounceMs: 0 }));

    act(() => result.current.search(BASE_PARAMS));
    await advanceDebounce(10);

    unmount();

    expect(abortedOnUnmount).toBe(true);
  });

  it('clears the debounce timer on unmount so no fetch fires after unmount', async () => {
    const { result, unmount } = renderHook(() => useSearchCommitments({ debounceMs: 500 }));

    act(() => {
      result.current.search(BASE_PARAMS);
    });

    // Debounce not yet fired
    unmount();

    // Advance timers — timer should have been cleared, no fetch
    await advanceDebounce(600);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ── abort() method ─────────────────────────────────────────────────────────

  it('abort() resets loading to false', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 0 }));
    act(() => result.current.search(BASE_PARAMS));
    await advanceDebounce(10);

    expect(result.current.loading).toBe(true);

    act(() => result.current.abort());

    expect(result.current.loading).toBe(false);
  });

  it('abort() cancels a pending debounce timer so no fetch fires', async () => {
    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 300 }));

    act(() => {
      result.current.search(BASE_PARAMS);
    });

    act(() => {
      result.current.abort();
    });

    await advanceDebounce(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ── Telemetry without chain-duration header ────────────────────────────────

  it('omits chainDurationMs from telemetry when header is absent (cache hit)', async () => {
    const cacheHitHeaders = makeHeaders({ 'X-Search-Cache-Hit': '1' });
    cacheHitHeaders.delete('X-Search-Chain-Duration-Ms');

    fetchMock.mockResolvedValue(
      new Response(makeSuccessBody([]), { status: 200, headers: cacheHitHeaders }),
    );

    const { result } = renderHook(() => useSearchCommitments({ debounceMs: 0 }));
    act(() => result.current.search(BASE_PARAMS));
    await advanceDebounce(50);

    expect(result.current.telemetry?.chainDurationMs).toBeUndefined();
    expect(result.current.telemetry?.cacheHit).toBe(true);
  });
});
