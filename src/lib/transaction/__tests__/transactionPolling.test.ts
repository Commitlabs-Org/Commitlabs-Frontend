/**
 * Tests for bounded polling mechanism.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pollWithBounds, createTimeoutAbortController, debouncePolling, throttlePolling } from '../transactionPolling';
import { DEFAULT_POLLING_CONFIG, TransactionErrorType } from '../transactionTypes';

describe('pollWithBounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should successfully poll until condition is met', async () => {
    let attempts = 0;
    const pollFn = vi.fn(async () => {
      attempts++;
      return attempts;
    });

    const result = await pollWithBounds({
      pollFn,
      shouldStop: (data) => data >= 3,
      config: {
        intervalMs: 100,
        maxDurationMs: 1000,
        maxAttempts: 10,
      },
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(3);
    expect(result.attempts).toBe(3);
    expect(pollFn).toHaveBeenCalledTimes(3);
  });

  it('should timeout when max duration is exceeded', async () => {
    const pollFn = vi.fn(async () => {
      return 1;
    });

    const result = await pollWithBounds({
      pollFn,
      shouldStop: () => false,
      config: {
        intervalMs: 100,
        maxDurationMs: 200,
        maxAttempts: 10,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toContain('timeout');
  });

  it('should timeout when max attempts is exceeded', async () => {
    const pollFn = vi.fn(async () => {
      return 1;
    });

    const result = await pollWithBounds({
      pollFn,
      shouldStop: () => false,
      config: {
        intervalMs: 10,
        maxDurationMs: 1000,
        maxAttempts: 2,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toContain('Max polling attempts');
  });

  it('should handle polling function errors gracefully', async () => {
    let attempts = 0;
    const pollFn = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary error');
      }
      return attempts;
    });

    const result = await pollWithBounds({
      pollFn,
      shouldStop: (data) => data >= 3,
      config: {
        intervalMs: 10,
        maxDurationMs: 1000,
        maxAttempts: 10,
      },
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(3);
    expect(pollFn).toHaveBeenCalledTimes(3);
  });

  it('should abort when signal is triggered', async () => {
    const pollFn = vi.fn(async () => {
      return 1;
    });

    const abortController = new AbortController();
    
    // Abort after 50ms
    setTimeout(() => abortController.abort(), 50);

    const result = await pollWithBounds({
      pollFn,
      shouldStop: () => false,
      config: {
        intervalMs: 10,
        maxDurationMs: 1000,
        maxAttempts: 100,
      },
      signal: abortController.signal,
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('aborted');
  });

  it('should validate polling bounds', async () => {
    const result = await pollWithBounds({
      pollFn: async () => 1,
      shouldStop: () => true,
      config: {
        intervalMs: 50, // Below minimum
        maxDurationMs: 1000,
        maxAttempts: 10,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Polling interval must be at least 100ms');
  });

  it('should validate max duration vs interval', async () => {
    const result = await pollWithBounds({
      pollFn: async () => 1,
      shouldStop: () => true,
      config: {
        intervalMs: 1000,
        maxDurationMs: 100, // Less than interval
        maxAttempts: 10,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Max polling duration must be greater than interval');
  });

  it('should validate max attempts', async () => {
    const result = await pollWithBounds({
      pollFn: async () => 1,
      shouldStop: () => true,
      config: {
        intervalMs: 100,
        maxDurationMs: 1000,
        maxAttempts: 0, // Invalid
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Max polling attempts must be at least 1');
  });

  it('should respect disabled polling', async () => {
    const result = await pollWithBounds({
      pollFn: async () => 1,
      shouldStop: () => true,
      config: {
        enabled: false,
        intervalMs: 100,
        maxDurationMs: 1000,
        maxAttempts: 10,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Polling is disabled');
  });
});

describe('createTimeoutAbortController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should abort after timeout', () => {
    const controller = createTimeoutAbortController(100);
    
    expect(controller.signal.aborted).toBe(false);
    
    vi.advanceTimersByTime(100);
    
    expect(controller.signal.aborted).toBe(true);
  });

  it('should not abort before timeout', () => {
    const controller = createTimeoutAbortController(100);
    
    vi.advanceTimersByTime(50);
    
    expect(controller.signal.aborted).toBe(false);
  });
});

describe('debouncePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce rapid calls', async () => {
    let callCount = 0;
    const pollFn = vi.fn(async () => {
      callCount++;
      return callCount;
    });

    const debounced = debouncePolling(pollFn, 100);

    const promise1 = debounced();
    const promise2 = debounced();
    const promise3 = debounced();

    await Promise.all([promise1, promise2, promise3]);

    expect(pollFn).toHaveBeenCalledTimes(1);
  });

  it('should allow calls after delay', async () => {
    let callCount = 0;
    const pollFn = vi.fn(async () => {
      callCount++;
      return callCount;
    });

    const debounced = debouncePolling(pollFn, 100);

    await debounced();

    vi.advanceTimersByTime(150);

    await debounced();

    expect(pollFn).toHaveBeenCalledTimes(2);
  });
});

describe('throttlePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throttle rapid calls', async () => {
    let callCount = 0;
    const pollFn = vi.fn(async () => {
      callCount++;
      return callCount;
    });

    const throttled = throttlePolling(pollFn, 100);

    const promise1 = throttled();
    const promise2 = throttled();
    const promise3 = throttled();

    await Promise.all([promise1, promise2, promise3]);

    expect(pollFn).toHaveBeenCalledTimes(1);
  });

  it('should allow calls after minimum interval', async () => {
    let callCount = 0;
    const pollFn = vi.fn(async () => {
      callCount++;
      return callCount;
    });

    const throttled = throttlePolling(pollFn, 100);

    await throttled();

    vi.advanceTimersByTime(150);

    await throttled();

    expect(pollFn).toHaveBeenCalledTimes(2);
  });
});
