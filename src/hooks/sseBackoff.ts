/**
 * Bounded exponential backoff for the dispute SSE reconnection logic.
 *
 * Extracted as a pure module so the delay math and the "give up" decision are
 * deterministic and unit-testable without driving a real (or mocked) EventSource /
 * fetch reader. The hook in `useDisputeSSE.ts` consumes these.
 */

/**
 * Compute the reconnect delay (ms) for a 1-based attempt number using
 * exponential backoff, capped at `maxDelayMs`.
 */
export function computeReconnectDelay(
  attempt: number,
  baseDelayMs: number,
  factor: number,
  maxDelayMs: number,
): number {
  const safeAttempt = Math.max(1, attempt);
  const raw = baseDelayMs * Math.pow(factor, safeAttempt - 1);
  return Math.min(raw, maxDelayMs);
}

/**
 * Whether the SSE reconnection loop should keep going given the number of
 * consecutive failed attempts.
 *
 * @param attempt   current attempt number (1-based)
 * @param maxAttempts the maximum allowed attempts (>= 1)
 */
export function shouldContinueReconnecting(attempt: number, maxAttempts: number): boolean {
  return attempt <= maxAttempts;
}
