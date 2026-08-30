/**
 * src/hooks/useCommitmentsSearch.ts
 *
 * Data-fetching hook for the commitment search API.
 *
 * Key invariants:
 *   - Stale responses never overwrite a newer query's results. A generation
 *     counter increments on every new search; the response callback checks
 *     its captured generation against the current before writing state.
 *   - Each in-flight request is cancelled (AbortController) when a new
 *     request supersedes it, preventing resource leaks and avoiding
 *     out-of-order updates.
 *   - Optional polling: when `pollIntervalMs` is set the hook issues a
 *     fresh fetch on that cadence. Polling is suspended while the document
 *     is hidden (Page Visibility API) to avoid background traffic.
 *   - Concurrent-request deduplication: if a previous fetch for the same
 *     serialized query is still in-flight, the hook skips the duplicate
 *     rather than racing two requests for the same data.
 *   - Client telemetry is collected and exposed via the `diagnostics` field
 *     so callers can surface latency / failure information without leaking
 *     any secrets or internal state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Public types ──────────────────────────────────────────────────────────

/** Search parameters forwarded to GET /api/commitments/search. */
export interface CommitmentsSearchParams {
  ownerAddress: string;
  asset?: string;
  commitmentId?: string;
  status?: 'CREATED' | 'ACTIVE' | 'SETTLED' | 'VIOLATED' | 'EARLY_EXIT';
  riskType?: 'Safe' | 'Balanced' | 'Aggressive';
  /** Inclusive lower bound: 0–100. */
  minCompliance?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'amount' | 'complianceScore' | 'status' | 'asset';
  sortOrder?: 'asc' | 'desc';
}

/** One item returned by the search API. */
export interface CommitmentSearchItem {
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

/** Pagination metadata attached to search responses. */
export interface SearchMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Applied-filter metadata returned by the API. */
export interface SearchFilters {
  asset: string | null;
  commitmentId: string | null;
  status: string | null;
  riskType: string | null;
  minCompliance: number | null;
  sortBy: string;
  sortOrder: string;
}

/**
 * Client-side diagnostics emitted per fetch.
 * All fields are safe to surface in the UI: no secrets, no internal stack
 * traces, no credential data.
 */
export interface SearchDiagnostics {
  /** Time from fetch start to first byte, in milliseconds. */
  latencyMs: number;
  /** Whether this result was served from the server-side cache. */
  cacheHit?: boolean;
  /** Whether the request was aborted (e.g. superseded by a newer query). */
  aborted: boolean;
  /** HTTP status code of the last response, if any. */
  httpStatus?: number;
  /** Error message (no internal details) if the request failed. */
  errorMessage?: string;
  /** ISO-8601 timestamp of the last attempt. */
  lastAttemptAt: string;
  /** Number of retries that occurred for the last successful result. */
  retryCount: number;
}

export interface UseCommitmentsSearchResult {
  items: CommitmentSearchItem[];
  meta: SearchMeta | null;
  filters: SearchFilters | null;
  isLoading: boolean;
  isError: boolean;
  /** Stable search function. Call with updated params to trigger a new fetch. */
  search: (params: CommitmentsSearchParams) => void;
  /** Manually trigger a refresh with the current parameters. */
  refresh: () => void;
  /** Client-side diagnostics for the most recent request. */
  diagnostics: SearchDiagnostics | null;
}

// ─── Configuration ─────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
/** Exponential back-off starting point (ms). */
const RETRY_BASE_MS = 300;
/** Hard upper bound on polling cadence (ms). */
const MIN_POLL_INTERVAL_MS = 5_000;
/** Maximum allowed polling interval (ms). */
const MAX_POLL_INTERVAL_MS = 5 * 60 * 1_000; // 5 min

// ─── Helpers ───────────────────────────────────────────────────────────────

function paramsToQueryString(params: CommitmentsSearchParams): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export interface UseCommitmentsSearchOptions {
  /**
   * Polling cadence in ms. When omitted (or 0) polling is disabled.
   * Clamped to [MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS].
   */
  pollIntervalMs?: number;
}

export function useCommitmentsSearch(
  options: UseCommitmentsSearchOptions = {},
): UseCommitmentsSearchResult {
  // ── State ────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<CommitmentSearchItem[]>([]);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [filters, setFilters] = useState<SearchFilters | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [diagnostics, setDiagnostics] = useState<SearchDiagnostics | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  /** Monotonically-increasing counter. Each new search call gets the next value. */
  const generationRef = useRef(0);
  /** AbortController for the in-flight request. */
  const abortControllerRef = useRef<AbortController | null>(null);
  /** Serialised query string for the last in-flight request (deduplication). */
  const inFlightQueryRef = useRef<string | null>(null);
  /** Current search params (kept as a ref so polling can access the latest). */
  const currentParamsRef = useRef<CommitmentsSearchParams | null>(null);
  /** Polling timer handle. */
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Core fetch ───────────────────────────────────────────────────────────

  const fetchCommitments = useCallback(
    async (params: CommitmentsSearchParams, myGeneration: number) => {
      const queryString = paramsToQueryString(params);

      // Deduplication: skip if an identical request is already in-flight.
      if (inFlightQueryRef.current === queryString) {
        return;
      }

      // Cancel any existing in-flight request.
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      inFlightQueryRef.current = queryString;

      setIsLoading(true);
      setIsError(false);

      const startedAt = Date.now();
      const attemptAt = new Date().toISOString();
      let retryCount = 0;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const backoff = RETRY_BASE_MS * 2 ** (attempt - 1);
            await delay(backoff, controller.signal);
          }

          const url = `/api/commitments/search?${queryString}`;
          const response = await fetch(url, { signal: controller.signal });

          // Stale-check: another search was started after us.
          if (generationRef.current !== myGeneration) {
            return;
          }

          const latencyMs = Date.now() - startedAt;

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const errorMessage =
              (errBody as { error?: { message?: string } })?.error?.message ??
              `HTTP ${response.status}`;

            setIsError(true);
            setDiagnostics({
              latencyMs,
              aborted: false,
              httpStatus: response.status,
              errorMessage,
              lastAttemptAt: attemptAt,
              retryCount,
            });

            // 4xx errors are not retryable.
            if (response.status >= 400 && response.status < 500) break;
            retryCount++;
            continue;
          }

          const json = await response.json();
          const payload = json?.data as {
            data: CommitmentSearchItem[];
            meta: SearchMeta;
            filters: SearchFilters;
          };

          // Final stale-check after awaiting JSON parse.
          if (generationRef.current !== myGeneration) {
            return;
          }

          setItems(payload.data ?? []);
          setMeta(payload.meta ?? null);
          setFilters(payload.filters ?? null);
          setIsError(false);
          setDiagnostics({
            latencyMs,
            aborted: false,
            httpStatus: response.status,
            lastAttemptAt: attemptAt,
            retryCount,
          });

          inFlightQueryRef.current = null;
          setIsLoading(false);
          return; // success — exit retry loop
        } catch (err) {
          if (isAbortError(err)) {
            setDiagnostics((prev) => ({
              ...(prev ?? {
                latencyMs: 0,
                lastAttemptAt: attemptAt,
                retryCount,
              }),
              aborted: true,
              latencyMs: Date.now() - startedAt,
              lastAttemptAt: attemptAt,
              retryCount,
            }));
            setIsLoading(false);
            inFlightQueryRef.current = null;
            return; // aborted — don't retry
          }

          retryCount++;
          if (attempt === MAX_RETRIES) {
            if (generationRef.current === myGeneration) {
              setIsError(true);
              setDiagnostics({
                latencyMs: Date.now() - startedAt,
                aborted: false,
                errorMessage: err instanceof Error ? err.message : 'Unknown error',
                lastAttemptAt: attemptAt,
                retryCount,
              });
            }
          }
        }
      }

      if (generationRef.current === myGeneration) {
        setIsLoading(false);
        inFlightQueryRef.current = null;
      }
    },
    [],
  );

  // ── Public API ────────────────────────────────────────────────────────────

  const search = useCallback(
    (params: CommitmentsSearchParams) => {
      currentParamsRef.current = params;
      const generation = ++generationRef.current;

      // Clear polling timer: it will restart after the fetch completes.
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      fetchCommitments(params, generation);
    },
    [fetchCommitments],
  );

  const refresh = useCallback(() => {
    if (currentParamsRef.current) {
      search(currentParamsRef.current);
    }
  }, [search]);

  // ── Polling ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const rawInterval = options.pollIntervalMs ?? 0;
    if (!rawInterval) return;

    const interval = Math.min(
      Math.max(rawInterval, MIN_POLL_INTERVAL_MS),
      MAX_POLL_INTERVAL_MS,
    );

    function scheduleNextPoll() {
      pollTimerRef.current = setTimeout(() => {
        // Skip polling when the document is hidden (battery / network saving).
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          scheduleNextPoll();
          return;
        }

        if (currentParamsRef.current) {
          const generation = ++generationRef.current;
          fetchCommitments(currentParamsRef.current, generation).finally(scheduleNextPoll);
        } else {
          scheduleNextPoll();
        }
      }, interval);
    }

    scheduleNextPoll();

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [options.pollIntervalMs, fetchCommitments]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  return { items, meta, filters, isLoading, isError, search, refresh, diagnostics };
}
