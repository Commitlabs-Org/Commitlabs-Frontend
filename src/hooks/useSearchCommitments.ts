/**
 * useSearchCommitments
 *
 * Custom React hook that wraps the `GET /api/commitments/search` endpoint
 * with:
 *
 *   1. AbortController — each new search cancels the previous in-flight
 *      request so stale responses can never overwrite a newer result.
 *
 *   2. Debounce — the API call is deferred by `debounceMs` (default 300 ms)
 *      to suppress redundant fetches during rapid filter/sort changes or
 *      fast keystrokes.
 *
 *   3. Stale-response prevention — even if two requests race to complete, a
 *      response that belongs to an earlier query generation is silently
 *      discarded.  The generation counter is incremented on every call to
 *      `search()` so only the most recently initiated query can update state.
 *
 *   4. Client-side telemetry — response `X-Search-*` headers are surfaced as
 *      `telemetry` in the return value so callers can log or display latency
 *      and cache information without parsing raw headers.  No secrets or
 *      internal details are leaked by these headers.
 *
 *   5. Cleanup on unmount — any in-flight request is aborted when the
 *      component using this hook unmounts, preventing state updates on
 *      unmounted components.
 *
 * Design tradeoffs:
 *   - The debounce is implemented with `setTimeout` rather than a library
 *     dependency (e.g. lodash.debounce).  This keeps the hook zero-dependency
 *     while remaining straightforward to test with fake timers.
 *   - The generation counter replaces a `useRef<AbortController>` approach
 *     because AbortController cancels the network request but does *not*
 *     prevent the `.then()` handler from running if cancellation races with
 *     completion.  The generation check provides a second safety net.
 *   - `loading` is set to `true` immediately on `search()` call (before the
 *     debounce fires) so the UI can show a loading indicator for slow typists
 *     while the debounce is still pending.
 *
 * Limitations:
 *   - This hook does not implement retry logic.  Transient network errors are
 *     surfaced via `error` and must be retried by the caller.
 *   - There is no client-side result cache; the server-side short-TTL cache
 *     (15 s) is the deduplication layer for identical queries.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SearchCommitmentsParams {
  ownerAddress: string;
  asset?: string;
  commitmentId?: string;
  status?: 'CREATED' | 'ACTIVE' | 'SETTLED' | 'VIOLATED' | 'EARLY_EXIT';
  riskType?: 'Safe' | 'Balanced' | 'Aggressive';
  minCompliance?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'amount' | 'complianceScore' | 'status' | 'asset';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchCommitmentsTelemetry {
  durationMs: number;
  chainDurationMs?: number;
  cacheHit: boolean;
  returnedCount: number;
  total: number;
  filteredCount: number;
  truncated: boolean;
}

export interface SearchCommitmentsResult {
  commitmentId: string;
  ownerAddress: string;
  asset: string;
  amount: string;
  status: string;
  riskType: string;
  complianceScore: number;
  currentValue: string;
  feeEarned: string;
  violationCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface SearchCommitmentsPage {
  data: SearchCommitmentsResult[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: Record<string, unknown>;
}

export interface UseSearchCommitmentsOptions {
  /** Debounce delay in milliseconds. Defaults to 300. */
  debounceMs?: number;
  /** Base path for the API. Defaults to '/api/commitments/search'. */
  apiBasePath?: string;
}

export interface UseSearchCommitmentsReturn {
  data: SearchCommitmentsPage | null;
  loading: boolean;
  error: Error | null;
  telemetry: SearchCommitmentsTelemetry | null;
  /** Trigger a new search with the given parameters. */
  search: (params: SearchCommitmentsParams) => void;
  /** Abort any in-flight request and reset state. */
  abort: () => void;
}

// ─── Header parsing helper ────────────────────────────────────────────────────

function parseTelemetryHeaders(headers: Headers): SearchCommitmentsTelemetry {
  const num = (name: string, fallback: number): number => {
    const raw = headers.get(name);
    const parsed = raw !== null ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const chainDurationRaw = headers.get('X-Search-Chain-Duration-Ms');
  return {
    durationMs: num('X-Search-Duration-Ms', 0),
    chainDurationMs:
      chainDurationRaw !== null && Number.isFinite(Number(chainDurationRaw))
        ? Number(chainDurationRaw)
        : undefined,
    cacheHit: headers.get('X-Search-Cache-Hit') === '1',
    returnedCount: num('X-Search-Returned-Count', 0),
    total: num('X-Search-Total', 0),
    filteredCount: num('X-Search-Filtered-Count', 0),
    truncated: headers.get('X-Search-Truncated') === '1',
  };
}

// ─── Hook implementation ──────────────────────────────────────────────────────

export function useSearchCommitments(
  options: UseSearchCommitmentsOptions = {},
): UseSearchCommitmentsReturn {
  const { debounceMs = 300, apiBasePath = '/api/commitments/search' } = options;

  const [data, setData] = useState<SearchCommitmentsPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [telemetry, setTelemetry] = useState<SearchCommitmentsTelemetry | null>(null);

  /**
   * Abort controller for the current in-flight request.
   * Replaced on every new `search()` call.
   */
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Generation counter.  Incremented synchronously on each `search()` call.
   * The async completion handler only commits state if the generation it
   * captured at call time still matches the current value.
   *
   * This is the second safety net against stale responses racing with
   * AbortController cancellation (see module docblock).
   */
  const generationRef = useRef(0);

  /**
   * Debounce timer handle.  Cleared on subsequent `search()` calls before
   * a new timer is set.
   */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clean up on unmount: abort any in-flight request and clear the debounce
   * timer so state updates on unmounted components cannot fire.
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  const abort = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    abortControllerRef.current?.abort();
    setLoading(false);
  }, []);

  const search = useCallback(
    (params: SearchCommitmentsParams) => {
      // Cancel any pending debounce timer.
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }

      // Abort the previous in-flight request so its completion handler
      // cannot overwrite the results of this newer query.
      abortControllerRef.current?.abort();

      // Increment generation so any still-resolving promise from the
      // aborted request is discarded when it completes.
      const thisGeneration = ++generationRef.current;

      // Show loading immediately (before the debounce fires) so the UI
      // can render a spinner for slow typists while the debounce is pending.
      setLoading(true);
      setError(null);

      debounceTimerRef.current = setTimeout(async () => {
        // Create a new AbortController for this specific request.
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Build query string from params (omit undefined values).
        const queryParams = new URLSearchParams();
        const entries: Array<[string, string | number | undefined]> = [
          ['ownerAddress', params.ownerAddress],
          ['asset', params.asset],
          ['commitmentId', params.commitmentId],
          ['status', params.status],
          ['riskType', params.riskType],
          ['minCompliance', params.minCompliance],
          ['page', params.page],
          ['pageSize', params.pageSize],
          ['sortBy', params.sortBy],
          ['sortOrder', params.sortOrder],
        ];
        for (const [key, value] of entries) {
          if (value !== undefined) {
            queryParams.set(key, String(value));
          }
        }

        const url = `${apiBasePath}?${queryParams.toString()}`;

        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
            credentials: 'include',
          });

          // Stale-response guard: if another search() was called after this
          // one started, discard this response.
          if (generationRef.current !== thisGeneration) {
            return;
          }

          const rawTelemetry = parseTelemetryHeaders(response.headers);

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const message =
              (body as { error?: { message?: string } })?.error?.message ??
              `Search failed with status ${response.status}`;
            throw new Error(message);
          }

          const json = await response.json();

          // Final stale-response check after the async JSON parse.
          if (generationRef.current !== thisGeneration) {
            return;
          }

          setData(json.data as SearchCommitmentsPage);
          setTelemetry(rawTelemetry);
          setError(null);
        } catch (err) {
          // Ignore abort errors — they are expected when a newer request
          // supersedes this one.
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }

          // Same generation check for error paths.
          if (generationRef.current !== thisGeneration) {
            return;
          }

          setError(err instanceof Error ? err : new Error(String(err)));
          setData(null);
          setTelemetry(null);
        } finally {
          // Only clear loading if this generation is still the current one.
          if (generationRef.current === thisGeneration) {
            setLoading(false);
          }
        }
      }, debounceMs);
    },
    [apiBasePath, debounceMs],
  );

  return { data, loading, error, telemetry, search, abort };
}
