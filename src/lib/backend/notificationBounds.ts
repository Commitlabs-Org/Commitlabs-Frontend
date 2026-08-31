/**
 * @module notificationBounds
 *
 * Explicit performance and operational bounds for notification API.
 *
 * Bounds enforce:
 * - Pagination limits: max page size, min/max page numbers
 * - Polling frequency: max requests per second per wallet
 * - Concurrent request limits: max in-flight mutations per wallet
 * - Memory bounds: max notifications held in store
 * - Failure budgets: max error rate before circuit-break
 *
 * All bounds are applied at route level and tracked per wallet.
 */

export const NOTIFICATION_BOUNDS = {
  // ─── Pagination ───────────────────────────────────────────────────────────
  /** Absolute maximum page size (client-supplied pageSize > this is clamped). */
  MAX_PAGE_SIZE: 100,
  /** Minimum page size. */
  MIN_PAGE_SIZE: 1,
  /** Maximum page number to prevent offset-based DoS. */
  MAX_PAGE_NUMBER: 1000,
  /** Default page size if not supplied. */
  DEFAULT_PAGE_SIZE: 10,

  // ─── Polling ──────────────────────────────────────────────────────────────
  /** Minimum milliseconds between GET requests per wallet (rate limit). */
  MIN_GET_INTERVAL_MS: 500,
  /** Maximum GET requests per wallet per second. */
  MAX_GET_RPS: 2,
  /** Window (ms) over which RPS is measured. */
  RATE_LIMIT_WINDOW_MS: 1000,

  // ─── Mutations ────────────────────────────────────────────────────────────
  /** Maximum concurrent PATCH requests per wallet (queued if exceeded). */
  MAX_CONCURRENT_MUTATIONS: 5,
  /** Timeout (ms) for a single mutation operation. */
  MUTATION_TIMEOUT_MS: 5000,
  /** Maximum idempotency key length (DoS mitigation). */
  MAX_IDEMPOTENCY_KEY_LENGTH: 512,

  // ─── Store ────────────────────────────────────────────────────────────────
  /** Absolute maximum notifications stored per wallet. */
  MAX_NOTIFICATIONS_PER_WALLET: 10000,
  /** Soft limit — warnings logged when exceeded. */
  SOFT_MAX_NOTIFICATIONS_PER_WALLET: 5000,

  // ─── Failure budgets ──────────────────────────────────────────────────────
  /** Error rate threshold (errors per 100 requests) before circuit break. */
  ERROR_RATE_THRESHOLD: 10,
  /** Window (ms) over which error rate is measured. */
  ERROR_WINDOW_MS: 60000, // 1 minute
  /** Duration (ms) to keep circuit open after threshold exceeded. */
  CIRCUIT_BREAK_DURATION_MS: 30000,
} as const;

export const PREFERENCE_BOUNDS = {
  // ─── Polling ──────────────────────────────────────────────────────────────
  /** Minimum milliseconds between GET requests per wallet. */
  MIN_GET_INTERVAL_MS: 1000,
  /** Maximum GET requests per wallet per second. */
  MAX_GET_RPS: 2,
  /** Rate limit window (ms). */
  RATE_LIMIT_WINDOW_MS: 1000,

  // ─── Mutations ────────────────────────────────────────────────────────────
  /** Maximum concurrent PUT requests per wallet. */
  MAX_CONCURRENT_MUTATIONS: 3,
  /** Timeout (ms) for a single PUT operation. */
  MUTATION_TIMEOUT_MS: 5000,
  /** Maximum request body size (JSON). */
  MAX_BODY_SIZE_BYTES: 65536, // 64 KiB

  // ─── Idempotency ──────────────────────────────────────────────────────────
  /** Maximum idempotency key length. */
  MAX_IDEMPOTENCY_KEY_LENGTH: 512,
  /** Time-to-live for idempotency cache entries. */
  IDEMPOTENCY_TTL_MS: 86400000, // 24 hours

  // ─── Failure budgets ──────────────────────────────────────────────────────
  /** Error rate threshold (errors per 100 requests). */
  ERROR_RATE_THRESHOLD: 10,
  /** Window (ms) over which error rate is measured. */
  ERROR_WINDOW_MS: 60000,
  /** Duration (ms) to keep circuit open. */
  CIRCUIT_BREAK_DURATION_MS: 30000,
} as const;

/**
 * Per-wallet rate limit state tracker.
 * Tracks GET request timestamps for sliding-window rate limiting.
 */
export class RateLimitTracker {
  private requests = new Map<string, number[]>(); // address → timestamps

  /**
   * Record a request timestamp for the wallet.
   * Clean up old entries outside the window.
   */
  recordRequest(address: string, windowMs: number): void {
    const now = Date.now();
    const timestamps = this.requests.get(address) ?? [];

    // Keep only timestamps within the window
    const recent = timestamps.filter((ts) => now - ts < windowMs);
    recent.push(now);

    this.requests.set(address, recent);
  }

  /**
   * Check if a request should be rate-limited.
   * Returns true if the request exceeds the RPS limit.
   */
  isRateLimited(address: string, maxRps: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(address) ?? [];

    // Clean up old entries
    const recent = timestamps.filter((ts) => now - ts < windowMs);

    return recent.length >= maxRps;
  }

  /**
   * Get the number of requests in the current window.
   */
  getRequestCount(address: string, windowMs: number): number {
    const now = Date.now();
    const timestamps = this.requests.get(address) ?? [];
    return timestamps.filter((ts) => now - ts < windowMs).length;
  }

  /**
   * Clear all tracking data (for tests).
   */
  reset(): void {
    this.requests.clear();
  }
}

/**
 * Per-wallet error rate tracker.
 * Tracks success/failure ratio for circuit-breaking decisions.
 */
export class ErrorRateTracker {
  private states = new Map<string, { errors: number; total: number; lastReset: number }>();
  private circuitBreakers = new Map<string, { openedAt: number }>();

  /**
   * Record a successful request.
   */
  recordSuccess(address: string, windowMs: number): void {
    this.ensureState(address, windowMs);
    const state = this.states.get(address)!;
    state.total += 1;
  }

  /**
   * Record a failed request.
   */
  recordError(address: string, windowMs: number): void {
    this.ensureState(address, windowMs);
    const state = this.states.get(address)!;
    state.errors += 1;
    state.total += 1;
  }

  /**
   * Get the current error rate (errors per 100 requests).
   */
  getErrorRate(address: string, windowMs: number): number {
    this.ensureState(address, windowMs);
    const state = this.states.get(address)!;
    if (state.total === 0) return 0;
    return Math.round((state.errors / state.total) * 100);
  }

  /**
   * Check if the circuit breaker is open (in failure mode).
   */
  isCircuitOpen(address: string, durationMs: number): boolean {
    const breaker = this.circuitBreakers.get(address);
    if (!breaker) return false;

    const elapsed = Date.now() - breaker.openedAt;
    if (elapsed > durationMs) {
      this.circuitBreakers.delete(address);
      return false;
    }

    return true;
  }

  /**
   * Open the circuit breaker for this wallet.
   */
  openCircuit(address: string): void {
    this.circuitBreakers.set(address, { openedAt: Date.now() });
  }

  /**
   * Check if error rate exceeds threshold; open circuit if it does.
   * Returns true if circuit was opened this call.
   */
  checkAndOpenCircuit(
    address: string,
    threshold: number,
    windowMs: number,
  ): boolean {
    const rate = this.getErrorRate(address, windowMs);
    if (rate >= threshold) {
      this.openCircuit(address);
      return true;
    }
    return false;
  }

  private ensureState(
    address: string,
    windowMs: number,
  ): void {
    if (!this.states.has(address)) {
      this.states.set(address, { errors: 0, total: 0, lastReset: Date.now() });
      return;
    }

    const state = this.states.get(address)!;
    const elapsed = Date.now() - state.lastReset;

    // Reset if window has passed
    if (elapsed > windowMs) {
      state.errors = 0;
      state.total = 0;
      state.lastReset = Date.now();
    }
  }

  /**
   * Clear all tracking data (for tests).
   */
  reset(): void {
    this.states.clear();
    this.circuitBreakers.clear();
  }
}

/**
 * Concurrent mutation tracker for per-wallet mutation limits.
 */
export class ConcurrentMutationTracker {
  private inFlight = new Map<string, number>();
  private queued = new Map<string, (() => Promise<void>)[]>();

  /**
   * Acquire a mutation slot for this wallet.
   * Returns immediately if under the limit, otherwise returns a promise
   * that resolves when a slot becomes available.
   */
  async acquire(address: string, maxConcurrent: number): Promise<() => void> {
    const current = this.inFlight.get(address) ?? 0;

    if (current < maxConcurrent) {
      this.inFlight.set(address, current + 1);
      return () => this.release(address);
    }

    // Queue the request
    return new Promise<() => void>((resolve) => {
      const queue = this.queued.get(address) ?? [];
      queue.push(async () => {
        this.inFlight.set(address, (this.inFlight.get(address) ?? 0) + 1);
        resolve(() => this.release(address));
      });
      this.queued.set(address, queue);
    });
  }

  /**
   * Release a mutation slot and process the next queued request.
   */
  private release(address: string): void {
    const current = this.inFlight.get(address) ?? 0;
    if (current > 0) {
      this.inFlight.set(address, current - 1);
    }

    const queue = this.queued.get(address);
    if (queue && queue.length > 0) {
      const next = queue.shift();
      if (next) {
        next().catch(() => {
          // Error already handled in caller
        });
      }
    }
  }

  /**
   * Get current in-flight count for testing/diagnostics.
   */
  getInFlight(address: string): number {
    return this.inFlight.get(address) ?? 0;
  }

  /**
   * Get queued count for testing/diagnostics.
   */
  getQueued(address: string): number {
    return this.queued.get(address)?.length ?? 0;
  }

  /**
   * Clear all tracking data (for tests).
   */
  reset(): void {
    this.inFlight.clear();
    this.queued.clear();
  }
}
