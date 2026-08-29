'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommitmentStatus {
  /** Canonical status string: 'Active' | 'Disputed' | 'Early Exit' | 'Settled' | 'Violated' */
  status: string;
  /** ISO-8601 timestamp of when the commitment expires */
  expiresAt?: string;
  /** Whole-number of days remaining before expiry */
  daysRemaining: number;
}

export interface CommitmentStatusContextValue {
  /** The current commitment status, or null while loading / on error */
  status: CommitmentStatus | null;
  /** True while the initial fetch is in-flight */
  isLoading: boolean;
  /** Non-null when the most recent fetch failed */
  error: string | null;
  /** ISO-8601 timestamp of the last successful poll */
  lastPollAt: string | null;
  /** Number of consecutive fetch failures */
  consecutiveFailures: number;
  /** Manually trigger a single re-fetch (subject to dedup) */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Constants & bounds
// ---------------------------------------------------------------------------

/** Interval between polls in ms when the status is Active and visible. */
const POLL_INTERVAL_ACTIVE_MS = 30_000;

/** Slower poll when commitment is terminal (Settled / Early Exit). */
const POLL_INTERVAL_TERMINAL_MS = 120_000;

/** Maximum consecutive failures before we stop polling and surface the error. */
const MAX_CONSECUTIVE_FAILURES = 5;

/** Minimum ms between two successive fetch calls (dedup window). */
const DEDUP_WINDOW_MS = 2_000;

/** Maximum age (ms) of a poll result before we consider it stale for UI hinting. */
const STALE_THRESHOLD_MS = 60_000;

/** Terminal statuses that should use slower polling. */
const TERMINAL_STATUSES = new Set(['Settled', 'Early Exit', 'Violated']);

/** Allowed status values for invariant checking. */
const VALID_STATUSES = new Set([
  'Active',
  'Disputed',
  'Early Exit',
  'Settled',
  'Violated',
  'Created',
  'Funded',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

function validateStatusPayload(data: unknown): data is CommitmentStatus {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.status !== 'string') return false;
  if (!VALID_STATUSES.has(obj.status)) return false;
  if (typeof obj.daysRemaining !== 'number' || !Number.isFinite(obj.daysRemaining)) return false;
  if (obj.daysRemaining < 0) return false;
  if (obj.expiresAt !== undefined && typeof obj.expiresAt !== 'string') return false;
  return true;
}

function computePollInterval(status: CommitmentStatus | null): number {
  if (status && isTerminalStatus(status.status)) return POLL_INTERVAL_TERMINAL_MS;
  return POLL_INTERVAL_ACTIVE_MS;
}

/**
 * Lightweight structured diagnostic logger.
 * Never leaks secrets — only emits numeric/string keys that are safe to
 * include in a client-side analytics beacon.
 */
function emitDiagnostic(event: string, meta: Record<string, string | number | boolean> = {}) {
  if (typeof window === 'undefined') return;
  try {
    // In production this would pipe to a real telemetry sink.
    // For now we emit to the console in dev only.
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[CommitmentStatus] ${event}`, meta);
    }
  } catch {
    // Swallow — diagnostics must never break the app.
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CommitmentStatusContext = createContext<CommitmentStatusContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CommitmentStatusProvider({
  commitmentId,
  children,
}: {
  commitmentId: string;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<CommitmentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPollAt, setLastPollAt] = useState<string | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Refs for stable values across renders
  const lastFetchAtRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const statusRef = useRef<CommitmentStatus | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const fetchStatus = useCallback(async () => {
    if (!commitmentId) return;

    // Dedup: skip if we fetched very recently
    const now = Date.now();
    if (now - lastFetchAtRef.current < DEDUP_WINDOW_MS) {
      emitDiagnostic('dedup_skip', { commitmentId });
      return;
    }
    lastFetchAtRef.current = now;

    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const t0 = performance.now();

    try {
      const response = await fetch(`/api/commitments/${encodeURIComponent(commitmentId)}/status`, {
        signal: controller.signal,
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Status fetch failed: HTTP ${response.status}`);
      }

      const json: unknown = await response.json();

      if (!validateStatusPayload(json)) {
        throw new Error('Status response failed invariant validation');
      }

      const latency = Math.round(performance.now() - t0);

      if (!mountedRef.current) return;

      setStatus(json);
      setError(null);
      setConsecutiveFailures(0);
      attemptRef.current = 0;
      setLastPollAt(new Date().toISOString());

      emitDiagnostic('status_ok', {
        commitmentId,
        status: json.status,
        daysRemaining: json.daysRemaining,
        latency,
      });
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      if ((err as Error).name === 'AbortError') return;

      const latency = Math.round(performance.now() - t0);
      const message = err instanceof Error ? err.message : 'Unknown fetch error';

      attemptRef.current += 1;
      setConsecutiveFailures((prev) => prev + 1);
      setError(message);

      emitDiagnostic('status_error', {
        commitmentId,
        attempt: attemptRef.current,
        latency,
        message: message.slice(0, 120),
      });
    } finally {
      if (!mountedRef.current) return;
      setIsLoading(false);
    }
  }, [commitmentId]);

  // Schedule next poll
  const scheduleNext = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Stop polling after too many failures
    if (attemptRef.current >= MAX_CONSECUTIVE_FAILURES) {
      emitDiagnostic('poll_stopped', {
        commitmentId,
        consecutiveFailures: attemptRef.current,
      });
      return;
    }

    const interval = computePollInterval(statusRef.current);
    // Add jitter: ±10%
    const jitter = interval * 0.1 * (Math.random() * 2 - 1);

    timerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        fetchStatus().then(() => {
          if (mountedRef.current) scheduleNext();
        });
      }
    }, interval + jitter);
  }, [commitmentId, fetchStatus]);

  // Initial fetch + start polling
  useEffect(() => {
    mountedRef.current = true;

    setIsLoading(true);
    fetchStatus().then(() => {
      if (mountedRef.current) {
        setIsLoading(false);
        scheduleNext();
      }
    });

    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [commitmentId, fetchStatus, scheduleNext]);

  const refresh = useCallback(() => {
    emitDiagnostic('manual_refresh', { commitmentId });
    fetchStatus();
  }, [commitmentId, fetchStatus]);

  const value = useMemo<CommitmentStatusContextValue>(
    () => ({
      status,
      isLoading,
      error,
      lastPollAt,
      consecutiveFailures,
      refresh,
    }),
    [status, isLoading, error, lastPollAt, consecutiveFailures, refresh],
  );

  return (
    <CommitmentStatusContext.Provider value={value}>{children}</CommitmentStatusContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCommitmentStatus(): CommitmentStatusContextValue {
  const context = useContext(CommitmentStatusContext);
  if (!context) {
    throw new Error('useCommitmentStatus must be used within a CommitmentStatusProvider');
  }
  return context;
}
