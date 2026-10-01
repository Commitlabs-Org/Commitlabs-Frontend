import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  retryableFromCode,
  startLatencyTimer,
  trackApiCall,
  SLOW_CALL_THRESHOLD_MS,
} from './index';

describe('retryableFromCode', () => {
  it('treats 5xx as retriable', () => {
    expect(retryableFromCode(undefined, 500)).toBe(true);
    expect(retryableFromCode(undefined, 502)).toBe(true);
    expect(retryableFromCode(undefined, 503)).toBe(true);
    expect(retryableFromCode(undefined, 504)).toBe(true);
  });

  it('treats 429 and 408 as retriable', () => {
    expect(retryableFromCode(undefined, 429)).toBe(true);
    expect(retryableFromCode(undefined, 408)).toBe(true);
  });

  it('treats transient error codes as retriable', () => {
    expect(retryableFromCode('TOO_MANY_REQUESTS', 429)).toBe(true);
    expect(retryableFromCode('SERVICE_UNAVAILABLE')).toBe(true);
    expect(retryableFromCode('GATEWAY_TIMEOUT')).toBe(true);
  });

  it('treats client error codes as non-retriable', () => {
    expect(retryableFromCode('VALIDATION_ERROR', 400)).toBe(false);
    expect(retryableFromCode('NOT_FOUND', 404)).toBe(false);
    expect(retryableFromCode('FORBIDDEN', 403)).toBe(false);
  });

  it('treats unknown/missing metadata as non-retriable', () => {
    expect(retryableFromCode(undefined, undefined)).toBe(false);
    expect(retryableFromCode('SOME_UNKNOWN_CODE')).toBe(false);
  });
});

describe('startLatencyTimer', () => {
  it('returns a positive elapsed duration', () => {
    const stop = startLatencyTimer();
    const ms = stop();
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('elapsed duration grows over time', () => {
    const stop = startLatencyTimer();
    const start = stop();
    // a tiny, non-elided computation so the two reads are separated in time
    void Array.from({ length: 1000 }, (_, i) => i).reduce((acc, n) => acc + n, 0);
    const end = stop();
    expect(end).toBeGreaterThanOrEqual(start);
  });
});

describe('trackApiCall', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits a redacted JSON diagnostics line to the console', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    trackApiCall({
      path: '/api/commitments/[id]/fund',
      method: 'POST',
      latencyMs: 250,
      ok: false,
      code: 'TOO_MANY_REQUESTS',
      status: 429,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse((spy.mock.calls[0]?.[0] ?? '') as string);
    expect(payload.event).toBe('api_call');
    expect(payload.path).toBe('/api/commitments/[id]/fund');
    expect(payload.ok).toBe(false);
    expect(payload.status).toBe(429);
    expect(payload.code).toBe('TOO_MANY_REQUESTS');
    expect(payload.slow).toBe(false);
  });

  it('marks slow calls when latency exceeds the threshold', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    trackApiCall({ path: '/api/analytics/user', latencyMs: SLOW_CALL_THRESHOLD_MS + 1, ok: true });
    const payload = JSON.parse((spy.mock.calls[0]?.[0] ?? '') as string);
    expect(payload.slow).toBe(true);
  });
});
