/**
 * Bounded polling mechanism for transaction confirmation.
 * Enforces explicit bounds on polling duration, attempts, and intervals.
 */

import type { PollingConfig, TransactionError } from './transactionTypes';
import {
  DEFAULT_POLLING_CONFIG,
  TRANSACTION_BOUNDS,
  TransactionErrorType,
  createTransactionError,
} from './transactionTypes';

/**
 * Polling result with metadata
 */
export interface PollingResult<T> {
  /** Whether polling succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: TransactionError;
  /** Number of polling attempts made */
  attempts: number;
  /** Total polling duration in milliseconds */
  durationMs: number;
}

/**
 * Polling options
 */
export interface PollingOptions<T> {
  /** Polling function that returns data or throws */
  pollFn: () => Promise<T>;
  /** Predicate to check if polling should stop (success condition) */
  shouldStop: (data: T) => boolean;
  /** Polling configuration */
  config?: Partial<PollingConfig>;
  /** Optional abort signal for cancellation */
  signal?: AbortSignal;
  /** Transaction ID for error tracking */
  transactionId?: string | undefined;
}

/**
 * Bounded polling implementation
 * Enforces limits on duration, attempts, and intervals
 */
export async function pollWithBounds<T>(
  options: PollingOptions<T>,
): Promise<PollingResult<T>> {
  const {
    pollFn,
    shouldStop,
    config: userConfig,
    signal,
    transactionId,
  } = options;

  const config: PollingConfig = {
    ...DEFAULT_POLLING_CONFIG,
    ...userConfig,
  };

  // Invariant: Validate polling bounds
  if (config.intervalMs < 100) {
    return {
      success: false,
      attempts: 0,
      durationMs: 0,
      error: createTransactionError(
        TransactionErrorType.VALIDATION_ERROR,
        'Polling interval must be at least 100ms',
        transactionId,
      ),
    };
  }

  if (config.maxDurationMs < config.intervalMs) {
    return {
      success: false,
      attempts: 0,
      durationMs: 0,
      error: createTransactionError(
        TransactionErrorType.VALIDATION_ERROR,
        'Max polling duration must be greater than interval',
        transactionId,
      ),
    };
  }

  if (config.maxAttempts < 1) {
    return {
      success: false,
      attempts: 0,
      durationMs: 0,
      error: createTransactionError(
        TransactionErrorType.VALIDATION_ERROR,
        'Max polling attempts must be at least 1',
        transactionId,
      ),
    };
  }

  // Invariant: Check if polling is disabled
  if (!config.enabled) {
    return {
      success: false,
      attempts: 0,
      durationMs: 0,
      error: createTransactionError(
        TransactionErrorType.VALIDATION_ERROR,
        'Polling is disabled',
        transactionId,
      ),
    };
  }

  const startTime = Date.now();
  let attempts = 0;
  let lastError: unknown = null;

  // Invariant: Check abort signal immediately
  if (signal?.aborted) {
    return {
      success: false,
      attempts: 0,
      durationMs: 0,
      error: createTransactionError(
        TransactionErrorType.VALIDATION_ERROR,
        'Polling aborted before start',
        transactionId,
      ),
    };
  }

  while (attempts < config.maxAttempts) {
    // Invariant: Check duration bound
    const elapsed = Date.now() - startTime;
    if (elapsed >= config.maxDurationMs) {
      return {
        success: false,
        attempts,
        durationMs: elapsed,
        error: createTransactionError(
          TransactionErrorType.POLLING_TIMEOUT,
          `Polling timeout after ${elapsed}ms (max: ${config.maxDurationMs}ms)`,
          transactionId,
          lastError,
        ),
      };
    }

    // Invariant: Check abort signal before each poll
    if (signal?.aborted) {
      return {
        success: false,
        attempts,
        durationMs: elapsed,
        error: createTransactionError(
          TransactionErrorType.VALIDATION_ERROR,
          'Polling aborted by signal',
          transactionId,
        ),
      };
    }

    attempts++;

    try {
      const data = await pollFn();

      // Check if we should stop polling
      if (shouldStop(data)) {
        const duration = Date.now() - startTime;
        return {
          success: true,
          data,
          attempts,
          durationMs: duration,
        };
      }
    } catch (error) {
      lastError = error;
      // Continue polling on error unless it's a fatal error
      // Fatal errors would be network failures that shouldn't be retried
    }

    // Wait for interval before next poll (unless this was the last attempt)
    if (attempts < config.maxAttempts) {
      const nextPollTime = startTime + (attempts * config.intervalMs);
      const now = Date.now();
      const delay = Math.max(0, nextPollTime - now);

      // Invariant: Ensure delay doesn't exceed remaining time
      const remainingTime = config.maxDurationMs - (Date.now() - startTime);
      if (delay > remainingTime) {
        return {
          success: false,
          attempts,
          durationMs: Date.now() - startTime,
          error: createTransactionError(
            TransactionErrorType.POLLING_TIMEOUT,
            'Insufficient time remaining for next poll',
            transactionId,
            lastError,
          ),
        };
      }

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, delay);
        signal?.addEventListener('abort', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
    }
  }

  // Max attempts exceeded
  const duration = Date.now() - startTime;
  return {
    success: false,
    attempts,
    durationMs: duration,
    error: createTransactionError(
      TransactionErrorType.POLLING_TIMEOUT,
      `Max polling attempts (${config.maxAttempts}) exceeded`,
      transactionId,
      lastError,
    ),
  };
}

/**
 * Create an abort controller with timeout
 */
export function createTimeoutAbortController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

/**
 * Debounce function to prevent rapid repeated polling
 */
export function debouncePolling<T>(
  pollFn: () => Promise<T>,
  delayMs: number,
): () => Promise<T> {
  let lastCallTime = 0;
  let pendingPromise: Promise<T> | null = null;

  return async (): Promise<T> => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall < delayMs && pendingPromise) {
      return pendingPromise;
    }

    lastCallTime = now;
    pendingPromise = pollFn();

    try {
      const result = await pendingPromise;
      return result;
    } finally {
      pendingPromise = null;
    }
  };
}

/**
 * Throttle polling to enforce minimum interval between calls
 */
export function throttlePolling<T>(
  pollFn: () => Promise<T>,
  minIntervalMs: number,
): () => Promise<T> {
  let lastCallTime = 0;
  let pendingPromise: Promise<T> | null = null;

  return async (): Promise<T> => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall < minIntervalMs) {
      const delay = minIntervalMs - timeSinceLastCall;
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }

    if (pendingPromise) {
      return pendingPromise;
    }

    lastCallTime = Date.now();
    pendingPromise = pollFn();

    try {
      const result = await pendingPromise;
      return result;
    } finally {
      pendingPromise = null;
    }
  };
}

/**
 * Exponential backoff for polling intervals
 */
export function calculateBackoffInterval(
  baseIntervalMs: number,
  attempt: number,
  maxIntervalMs: number = TRANSACTION_BOUNDS.MAX_POLLING_DURATION_MS,
): number {
  const exponentialInterval = baseIntervalMs * Math.pow(2, attempt);
  return Math.min(exponentialInterval, maxIntervalMs);
}

/**
 * Adaptive polling with exponential backoff
 */
export async function pollWithBackoff<T>(
  options: PollingOptions<T> & { maxIntervalMs?: number },
): Promise<PollingResult<T>> {
  const { pollFn, shouldStop, config, signal, transactionId, maxIntervalMs } = options;
  let attempt = 0;

  const adaptivePollFn = async (): Promise<T> => {
    attempt++;
    return pollFn();
  };

  const adaptiveConfig: Partial<PollingConfig> = {
    ...config,
    intervalMs: calculateBackoffInterval(
      config?.intervalMs || DEFAULT_POLLING_CONFIG.intervalMs,
      attempt,
      maxIntervalMs,
    ),
  };

  const pollOptions: PollingOptions<T> = {
    pollFn: adaptivePollFn,
    shouldStop,
    config: adaptiveConfig,
  };

  if (signal !== undefined) {
    pollOptions.signal = signal;
  }
  if (transactionId !== undefined) {
    pollOptions.transactionId = transactionId;
  }

  return pollWithBounds(pollOptions);
}
