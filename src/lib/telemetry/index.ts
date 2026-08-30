'use client';

/**
 * Lightweight client diagnostics & retry-policy helpers.
 *
 * The app's backend exposes a rich error-code registry (`errorCodes.ts`) and
 * structured server logging, but nothing on the *client* surfaces latency /
 * failure / recovery signals. These helpers give components a small, safe way
 * to record structured, redacted diagnostics and to decide whether an API
 * failure is worth offering a retry.
 *
 * Safety: `trackApiCall` only ever receives a normalized path and a handful of
 * scalar fields — never the full URL, query string, Authorization headers, or
 * response bodies — so credentials and personal data cannot leak through the
 * diagnostics channel.
 */

/** Number of milliseconds to wait before an API call is considered slow. */
export const SLOW_CALL_THRESHOLD_MS = 1000;

export interface ApiCallDiagnostics {
  /** Normalized endpoint path with no query string (e.g. `/api/commitments/[id]/fund`). */
  path: string;
  /** HTTP method of the call. */
  method?: string;
  /** Measured call duration. */
  latencyMs: number;
  /** Whether the call returned a 2xx (or otherwise "ok") result. */
  ok: boolean;
  /** Error code from the API envelope (e.g. `TOO_MANY_REQUESTS`), when present. */
  code?: string;
  /** HTTP status code of the response, when available. */
  status?: number;
  /** Whether this diagnostics line represents a retry (vs an initial attempt). */
  isRetry?: boolean;
}

/**
 * HTTP statuses and error codes that the client treats as transient and worth
 * retrying with backoff. Mirrors the backend registry's `retriable` semantics
 * for the transient classes; 4xx validation/permission codes are excluded.
 */
const RETRIABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRIABLE_CODES = new Set([
  'TOO_MANY_REQUESTS',
  'SERVICE_UNAVAILABLE',
  'BAD_GATEWAY',
  'GATEWAY_TIMEOUT',
  'BLOCKCHAIN_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

/**
 * Decide whether a failed API call should be retried, based on its status code
 * and/or envelope error code. Used to drive "Retry" affordances in loading
 * boundaries. Deterministic and pure.
 */
export function retryableFromCode(code: string | undefined, status?: number): boolean {
  if (status !== undefined && RETRIABLE_STATUS.has(status)) return true;
  if (code !== undefined && RETRIABLE_CODES.has(code)) return true;
  return false;
}

/**
 * Create a latency timer. Call the returned function later to get elapsed ms.
 *
 * @example
 * const stop = startLatencyTimer();
 * const ms = stop();
 */
export function startLatencyTimer(): () => number {
  const start = performance.now();
  return () => performance.now() - start;
}

/**
 * Record a redacted, structured client-side diagnostics line.
 *
 * Emits a single JSON line tagged `event: "api_call"` to the console so
 * latency, failures, and recovery paths are observable in dev/tests without a
 * third-party telemetry dependency. Swap the sink later if needed.
 */
export function trackApiCall(diagnostics: ApiCallDiagnostics): void {
  const entry = {
    event: 'api_call',
    timestamp: new Date().toISOString(),
    slow: diagnostics.latencyMs >= SLOW_CALL_THRESHOLD_MS,
    ...diagnostics,
  };
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(entry));
}
