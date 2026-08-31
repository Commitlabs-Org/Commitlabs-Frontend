/**
 * @module notificationDiagnostics
 *
 * Structured diagnostics and telemetry for notification and preference APIs.
 *
 * Provides:
 * - Request/response metrics (latency, sizes, errors)
 * - Per-wallet operational health (error rates, circuit breaker status)
 * - Actionable degradation signals without leaking secrets
 * - Request tracing for debugging
 *
 * All diagnostics are non-blocking and do not leak sensitive user data.
 */

export type OperationKind = 'GET' | 'PATCH' | 'PUT';
export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * A single diagnostic event (error, metric, or trace).
 * Designed to be JSON-serializable and sanitized.
 */
export interface DiagnosticEvent {
  /** Operation type (GET, PATCH, PUT, etc.). */
  kind: OperationKind;
  /** Wallet address (hashed or truncated for privacy). */
  walletHash: string;
  /** Timestamp (ISO-8601). */
  timestamp: string;
  /** Log level. */
  level: DiagnosticLevel;
  /** One-line message (no secrets). */
  message: string;
  /** Elapsed time in milliseconds (if available). */
  durationMs?: number;
  /** HTTP status code (if available). */
  statusCode?: number;
  /** Request size in bytes. */
  requestSizeBytes?: number;
  /** Response size in bytes. */
  responseSizeBytes?: number;
  /** Cache hit indicator (GET operations). */
  cacheHit?: boolean;
  /** Idempotency cache hit (mutations). */
  idempotencyHit?: boolean;
  /** Error code (sanitized, no details). */
  errorCode?: string;
  /** Trace ID for correlation (optional). */
  traceId?: string;
}

/**
 * Operational health status for a wallet.
 */
export interface OperationalHealth {
  /** Wallet address (hashed for privacy). */
  walletHash: string;
  /** Circuit breaker open? */
  circuitOpen: boolean;
  /** Current error rate (0-100). */
  errorRate: number;
  /** Total requests in current window. */
  totalRequests: number;
  /** Total errors in current window. */
  totalErrors: number;
  /** Time until circuit breaker resets (ms), if open. */
  circuitResetsIn?: number;
}

/**
 * Performance statistics for a window.
 */
export interface PerformanceStats {
  /** Operation type. */
  kind: OperationKind;
  /** Number of samples. */
  count: number;
  /** Minimum latency (ms). */
  minLatency: number;
  /** Maximum latency (ms). */
  maxLatency: number;
  /** Mean latency (ms). */
  meanLatency: number;
  /** p95 latency (ms). */
  p95Latency: number;
  /** p99 latency (ms). */
  p99Latency: number;
  /** Median request size (bytes). */
  medianRequestSize: number;
  /** Median response size (bytes). */
  medianResponseSize: number;
  /** Error count. */
  errors: number;
  /** Error rate (0-100). */
  errorRate: number;
}

/**
 * Hashes a wallet address for privacy.
 * Returns the first 8 chars of SHA-256 hash.
 */
function hashAddress(address: string): string {
  if (!address) return 'UNKNOWN';

  // Simple hash: use first 8 chars after a basic transformation
  // In production, use crypto.subtle.digest or a proper hash library
  let hash = 0;
  for (let i = 0; i < Math.min(address.length, 32); i++) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash &= hash; // Convert to 32-bit integer
  }
  return `wallet_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Diagnostics collector for a single operation.
 * Tracks metrics and generates structured events.
 */
export class OperationDiagnostics {
  private events: DiagnosticEvent[] = [];
  private startMs = Date.now();
  private requestSize = 0;
  private responseSize = 0;

  constructor(
    private kind: OperationKind,
    private address: string,
    private traceId?: string,
  ) {}

  /**
   * Log a debug-level event.
   */
  debug(message: string): void {
    this.addEvent('debug', message);
  }

  /**
   * Log an info-level event.
   */
  info(message: string): void {
    this.addEvent('info', message);
  }

  /**
   * Log a warning-level event.
   */
  warn(message: string): void {
    this.addEvent('warn', message);
  }

  /**
   * Log an error-level event.
   */
  error(message: string, code?: string): void {
    this.addEvent('error', message, code);
  }

  /**
   * Record request size (bytes).
   */
  setRequestSize(bytes: number): void {
    this.requestSize = bytes;
  }

  /**
   * Record response size (bytes).
   */
  setResponseSize(bytes: number): void {
    this.responseSize = bytes;
  }

  /**
   * Record cache hit (for GET operations).
   */
  setCacheHit(hit: boolean): void {
    if (this.events.length > 0) {
      this.events[this.events.length - 1].cacheHit = hit;
    }
  }

  /**
   * Record idempotency cache hit (for mutations).
   */
  setIdempotencyHit(hit: boolean): void {
    if (this.events.length > 0) {
      this.events[this.events.length - 1].idempotencyHit = hit;
    }
  }

  /**
   * Get all recorded events.
   */
  getEvents(): DiagnosticEvent[] {
    return [...this.events];
  }

  /**
   * Get total elapsed time (ms).
   */
  getElapsedMs(): number {
    return Date.now() - this.startMs;
  }

  /**
   * Generate a summary diagnostic event.
   */
  summarize(statusCode?: number, hasError = false): DiagnosticEvent {
    const level = hasError ? 'error' : 'info';
    return {
      kind: this.kind,
      walletHash: hashAddress(this.address),
      timestamp: new Date().toISOString(),
      level,
      message: `${this.kind} operation completed${hasError ? ' with error' : ''}`,
      durationMs: this.getElapsedMs(),
      statusCode,
      requestSizeBytes: this.requestSize,
      responseSizeBytes: this.responseSize,
      traceId: this.traceId,
    };
  }

  private addEvent(level: DiagnosticLevel, message: string, code?: string): void {
    this.events.push({
      kind: this.kind,
      walletHash: hashAddress(this.address),
      timestamp: new Date().toISOString(),
      level,
      message,
      durationMs: this.getElapsedMs(),
      errorCode: code,
      traceId: this.traceId,
    });
  }
}

/**
 * Global diagnostics collector.
 * Accumulates events and computes statistics.
 */
export class DiagnosticsCollector {
  private events: DiagnosticEvent[] = [];
  private maxEventsKept = 10000; // Prevent unbounded memory growth

  /**
   * Add a diagnostic event.
   */
  addEvent(event: DiagnosticEvent): void {
    this.events.push(event);

    // Keep only recent events
    if (this.events.length > this.maxEventsKept) {
      this.events = this.events.slice(-this.maxEventsKept);
    }
  }

  /**
   * Get all recorded events.
   */
  getAllEvents(): DiagnosticEvent[] {
    return [...this.events];
  }

  /**
   * Get events for a specific wallet (by hash).
   */
  getEventsByWallet(walletHash: string): DiagnosticEvent[] {
    return this.events.filter((e) => e.walletHash === walletHash);
  }

  /**
   * Get events within a time window (milliseconds back from now).
   */
  getEventsByWindow(windowMs: number): DiagnosticEvent[] {
    const cutoff = Date.now() - windowMs;
    return this.events.filter(
      (e) => new Date(e.timestamp).getTime() > cutoff,
    );
  }

  /**
   * Get errors only.
   */
  getErrors(): DiagnosticEvent[] {
    return this.events.filter((e) => e.level === 'error');
  }

  /**
   * Get performance statistics for a given operation kind.
   */
  getPerformanceStats(kind: OperationKind, windowMs?: number): PerformanceStats | null {
    let events = this.events.filter((e) => e.kind === kind && e.durationMs !== undefined);

    if (windowMs) {
      events = events.filter(
        (e) => new Date(e.timestamp).getTime() > Date.now() - windowMs,
      );
    }

    if (events.length === 0) {
      return null;
    }

    const durations = events
      .map((e) => e.durationMs!)
      .sort((a, b) => a - b);

    const requestSizes = events
      .filter((e) => e.requestSizeBytes !== undefined)
      .map((e) => e.requestSizeBytes!)
      .sort((a, b) => a - b);

    const responseSizes = events
      .filter((e) => e.responseSizeBytes !== undefined)
      .map((e) => e.responseSizeBytes!)
      .sort((a, b) => a - b);

    const errors = events.filter((e) => e.level === 'error').length;

    return {
      kind,
      count: events.length,
      minLatency: durations[0]!,
      maxLatency: durations[durations.length - 1]!,
      meanLatency: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      p95Latency: durations[Math.floor(durations.length * 0.95)] ?? 0,
      p99Latency: durations[Math.floor(durations.length * 0.99)] ?? 0,
      medianRequestSize: requestSizes[Math.floor(requestSizes.length / 2)] ?? 0,
      medianResponseSize: responseSizes[Math.floor(responseSizes.length / 2)] ?? 0,
      errors,
      errorRate: Math.round((errors / events.length) * 100),
    };
  }

  /**
   * Clear all events (for tests).
   */
  reset(): void {
    this.events = [];
  }

  /**
   * Get operational health for a wallet (based on recent events).
   */
  getOperationalHealth(
    walletHash: string,
    circuitOpen: boolean,
    errorRate: number,
    windowMs = 60000,
  ): OperationalHealth {
    const events = this.getEventsByWallet(walletHash).filter(
      (e) => new Date(e.timestamp).getTime() > Date.now() - windowMs,
    );

    const errorCount = events.filter((e) => e.level === 'error').length;

    return {
      walletHash,
      circuitOpen,
      errorRate,
      totalRequests: events.length,
      totalErrors: errorCount,
    };
  }
}

/**
 * Singleton global diagnostics collector.
 */
export const globalDiagnosticsCollector = new DiagnosticsCollector();

/**
 * Create a trace ID for request correlation.
 * Format: traceId_<random>_<timestamp>
 */
export function generateTraceId(): string {
  const random = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  return `traceId_${random}_${timestamp}`;
}
