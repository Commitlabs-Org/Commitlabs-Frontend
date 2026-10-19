import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJson, sanitizeUrl } from './http';

describe('http.ts - fetchJson', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('handles success', async () => {
    const mockData = { balance: '100.5' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const res = await fetchJson<typeof mockData>('https://example.com/api/test');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual(mockData);
      expect(res.status).toBe(200);
    }
  });

  it('handles HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'Account missing' }),
    });

    const res = await fetchJson('https://example.com/api/missing');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.kind).toBe('http');
      expect(res.status).toBe(404);
      expect(res.error).toContain('404');
    }
  });

  it('handles network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const res = await fetchJson('https://example.com/api/down');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.kind).toBe('network');
      expect(res.error).toContain('Failed to fetch');
    }
  });

  it('handles timeout using fake timers', async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockImplementation((_url: unknown, init?: RequestInit) => {
      return new Promise((_, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        }
      });
    });

    const promise = fetchJson('https://example.com/api/slow', { timeoutMs: 5000 });

    // Advance fake timers past 5000ms
    vi.advanceTimersByTime(5001);

    const res = await promise;
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.kind).toBe('timeout');
      expect(res.error).toContain('timed out');
    }
  });

  it('respects retry count', async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      calls++;
      if (calls < 3) {
        return Promise.reject(new TypeError('Network glitch'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
    });

    const res = await fetchJson('https://example.com/api/retry', {
      retries: 2,
      retryDelayMs: 0,
    });

    expect(calls).toBe(3);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ success: true });
    }
  });

  it('sanitizes URLs by stripping query strings and hashes in production', () => {
    const url = 'https://horizon.stellar.org/accounts/G123?secret=token&cursor=abc#section';
    expect(sanitizeUrl(url)).toBe('https://horizon.stellar.org/accounts/G123');
  });

  it('stops immediately when external signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const res = await fetchJson('https://example.com/api/cancelled', {
      signal: controller.signal,
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.kind).toBe('network');
      expect(res.error).toBe('Request was cancelled');
    }
  });
});
