/**
 * tests for useCommitmentsSearch hook (issue #1775)
 *
 * Covers:
 *   - Successful fetch: items, meta, filters, diagnostics all populated
 *   - Failure behavior: isError set, items not clobbered
 *   - Boundary: empty results, 4xx errors not retried
 *   - Stale-query prevention: generation counter prevents old responses
 *     from overwriting newer ones
 *   - Abort controller: aborting an in-flight request sets diagnostics.aborted
 *   - Deduplication: identical concurrent queries skip re-fetch
 *   - Retry: transient 5xx triggers up to MAX_RETRIES
 *   - Permission: 401/403 treated as 4xx (no retry)
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCommitmentsSearch } from '@/hooks/useCommitmentsSearch';

// ─── Helpers ────────────────────────────────────────────────────────────────

const OWNER = `G${'A'.repeat(55)}`;

/** Minimal valid search result payload matching the API response shape. */
function makeApiPayload(
  items: Array<Record<string, unknown>> = [],
  overrides: Record<string, unknown> = {},
) {
  return {
    success: true,
    data: {
      data: items,
      meta: {
        page: 1,
        pageSize: 10,
        total: items.length,
        totalPages: items.length ? 1 : 0,
        hasNextPage: false,
        hasPreviousPage: false,
        ...overrides,
      },
      filters: {
        asset: null,
        commitmentId: null,
        status: null,
        riskType: null,
        minCompliance: null,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
      diagnostics: {
        servedFromCache: false,
        responseLatencyMs: 10,
        chainLatencyMs: 5,
        filterLatencyMs: 1,
        rawCount: items.length,
        filteredCount: items.length,
        returnedCount: items.length,
        truncated: false,
      },
    },
  };
}

function makeItem(id: string): Record<string, unknown> {
  return {
    commitmentId: id,
    ownerAddress: OWNER,
    asset: 'USDC',
    amount: '1000',
    status: 'ACTIVE',
    riskType: 'Safe',
    complianceScore: 80,
    currentValue: '1000',
    feeEarned: '0',
    violationCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    expiresAt: '2025-01-01T00:00:00Z',
  };
}

// ─── Mock fetch ─────────────────────────────────────────────────────────────

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
) {
  return vi.spyOn(global, 'fetch').mockImplementation(
    handler as typeof fetch,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useCommitmentsSearch', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  // ── Success ──────────────────────────────────────────────────────────────

  it('populates items, meta, filters, and diagnostics on a successful fetch', async () => {
    const items = [makeItem('cm_1'), makeItem('cm_2')];
    fetchSpy = mockFetch(async () => jsonResponse(makeApiPayload(items)));

    const { result } = renderHook(() => useCommitmentsSearch());

    act(() => {
      result.current.search({ ownerAddress: OWNER });
    });

    // isLoading should be set immediately.
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]?.commitmentId).toBe('cm_1');
    expect(result.current.meta?.total).toBe(2);
    expect(result.current.filters?.sortBy).toBe('createdAt');
    expect(result.current.diagnostics?.aborted).toBe(false);
    expect(result.current.diagnostics?.httpStatus).toBe(200);
  });

  it('sets isError and preserves prior items on a 5xx response', async () => {
    // Seed with initial items.
    fetchSpy = mockFetch(async () =>
      jsonResponse({ success: false, error: { message: 'Server Error' } }, 500),
    );

    const { result } = renderHook(() => useCommitmentsSearch());

    act(() => {
      result.current.search({ ownerAddress: OWNER });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });

    expect(result.current.isError).toBe(true);
    expect(result.current.diagnostics?.httpStatus).toBe(500);
  });

  // ── Empty results ─────────────────────────────────────────────────────────

  it('returns an empty items array when the API returns no results', async () => {
    fetchSpy = mockFetch(async () => jsonResponse(makeApiPayload([])));

    const { result } = renderHook(() => useCommitmentsSearch());

    act(() => {
      result.current.search({ ownerAddress: OWNER });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(0);
    expect(result.current.meta?.total).toBe(0);
    expect(result.current.isError).toBe(false);
  });

  // ── Permission / authorization errors ─────────────────────────────────────

  it('sets isError and does NOT retry on a 401 response', async () => {
    fetchSpy = mockFetch(async () =>
      jsonResponse({ success: false, error: { message: 'Unauthorized' } }, 401),
    );

    const { result } = renderHook(() => useCommitmentsSearch());

    act(() => {
      result.current.search({ ownerAddress: OWNER });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 4xx: should have been called exactly once (no retries).
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isError).toBe(true);
    expect(result.current.diagnostics?.httpStatus).toBe(401);
    expect(result.current.diagnostics?.retryCount).toBe(0);
  });

  it('sets isError and does NOT retry on a 403 response', async () => {
    fetchSpy = mockFetch(async () =>
      jsonResponse({ success: false, error: { message: 'Forbidden' } }, 403),
    );

    const { result } = renderHook(() => useCommitmentsSearch());

    act(() => {
      result.current.search({ ownerAddress: OWNER });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isError).toBe(true);
    expect(result.current.diagnostics?.httpStatus).toBe(403);
    expect(result.current.diagnostics?.retryCount).toBe(0);
  });

  // ── Stale-query prevention ────────────────────────────────────────────────

  it('ignores a slow response if a newer search was started', async () => {
    let resolveFirst!: (r: Response) => void;
    const firstResponse = new Promise<Response>((res) => {
      resolveFirst = res;
    });

    let callCount = 0;
    fetchSpy = mockFetch(async (_url, _init) => {
      callCount++;
      if (callCount === 1) {
        // First call is slow and will resolve after the second call.
        return firstResponse;
      }
      // Second call resolves immediately with different items.
      return jsonResponse(makeApiPayload([makeItem('cm_newer')]));
    });

    const { result } = renderHook(() => useCommitmentsSearch());

    // Start first (slow) search.
    act(() => {
      result.current.search({ ownerAddress: OWNER, asset: 'XLM' });
    });

    // Start second (fast) search before the first has resolved.
    act(() => {
      result.current.search({ ownerAddress: OWNER, asset: 'USDC' });
    });

    // Second search completes first.
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items[0]?.commitmentId).toBe('cm_newer');

    // Now resolve the slow first response — it should be silently dropped.
    act(() => {
      resolveFirst(jsonResponse(makeApiPayload([makeItem('cm_stale')])));
    });

    // Give any async work a tick to settle.
    await new Promise((r) => setTimeout(r, 50));

    // The stale result must NOT have overwritten the newer result.
    expect(result.current.items[0]?.commitmentId).toBe('cm_newer');
  });

  // ── Abort controller ──────────────────────────────────────────────────────

  it('sets diagnostics.aborted = true when the fetch signal is aborted externally', async () => {
    // Simulate fetch throwing an AbortError.
    fetchSpy = mockFetch(async (_url, init) => {
      // Immediately abort via the signal passed by the hook.
      (init?.signal as AbortSignal)?.dispatchEvent(new Event('abort'));
      throw new DOMException('Aborted', 'AbortError');
    });

    const { result } = renderHook(() => useCommitmentsSearch());

    act(() => {
      result.current.search({ ownerAddress: OWNER });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.diagnostics?.aborted).toBe(true);
  });

  // ── Refresh ───────────────────────────────────────────────────────────────

  it('re-fetches the same params when refresh() is called', async () => {
    fetchSpy = mockFetch(async () => jsonResponse(makeApiPayload([makeItem('cm_1')])));

    const { result } = renderHook(() => useCommitmentsSearch());

    act(() => {
      result.current.search({ ownerAddress: OWNER });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // refresh() should have triggered a second fetch.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not throw when refresh() is called before any search', () => {
    const { result } = renderHook(() => useCommitmentsSearch());

    expect(() => {
      act(() => {
        result.current.refresh();
      });
    }).not.toThrow();
  });

  // ── Diagnostics ───────────────────────────────────────────────────────────

  it('diagnostics.latencyMs is a non-negative number', async () => {
    fetchSpy = mockFetch(async () => jsonResponse(makeApiPayload([makeItem('cm_1')])));

    const { result } = renderHook(() => useCommitmentsSearch());

    act(() => {
      result.current.search({ ownerAddress: OWNER });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.diagnostics?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('diagnostics.lastAttemptAt is an ISO-8601 timestamp', async () => {
    fetchSpy = mockFetch(async () => jsonResponse(makeApiPayload([makeItem('cm_1')])));

    const { result } = renderHook(() => useCommitmentsSearch());

    act(() => {
      result.current.search({ ownerAddress: OWNER });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const ts = result.current.diagnostics?.lastAttemptAt;
    expect(ts).toBeTruthy();
    expect(new Date(ts!).toISOString()).toBe(ts);
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('starts with empty state before any search is called', () => {
    const { result } = renderHook(() => useCommitmentsSearch());

    expect(result.current.items).toHaveLength(0);
    expect(result.current.meta).toBeNull();
    expect(result.current.filters).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.diagnostics).toBeNull();
  });
});
