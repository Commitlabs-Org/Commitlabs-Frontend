// src/lib/__tests__/apiClient.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, ApiError } from '@/lib/apiClient';

function mockFetch(response: unknown, ok = true, status = 200, headers: Record<string, string> = {}) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      headers: {
        get: (key: string) => headers[key] ?? null,
      },
      json: () => Promise.resolve(response),
    })
  ));
}

function mockFetchNonJson(body: string, status = 502, statusText = 'Bad Gateway') {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status,
      statusText,
      headers: {
        get: (key: string) => (key === 'content-type' ? 'text/html' : null),
      },
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    })
  ));
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns data on successful envelope', async () => {
    const payload = { ok: true, data: { foo: 'bar' } };
    mockFetch(payload);
    const data = await apiGet<{ foo: string }>('/api/test');
    expect(data).toEqual({ foo: 'bar' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('throws ApiError on error envelope', async () => {
    const errorPayload = { ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } };
    mockFetch(errorPayload, false, 404);
    await expect(apiGet('/api/missing')).rejects.toThrow(ApiError);
    await expect(apiGet('/api/missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    });
  });

  it('throws timeout error when request aborts', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    await expect(apiGet('/api/slow', 10)).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('includes retryAfterSeconds from error envelope when present', async () => {
    const payload = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryAfterSeconds: 30,
      },
    };
    mockFetch(payload, false, 429);
    await expect(apiGet('/api/rate-limited')).rejects.toThrow(ApiError);
    await expect(apiGet('/api/rate-limited')).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: 30,
    });
  });

  it('includes correlationId from error envelope when present', async () => {
    const payload = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
        correlationId: 'req-abc-123',
      },
    };
    mockFetch(payload, false, 500);
    await expect(apiGet('/api/error')).rejects.toThrow(ApiError);
    await expect(apiGet('/api/error')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      correlationId: 'req-abc-123',
    });
  });

  it('throws with HTTP status for non-OK non-JSON responses', async () => {
    mockFetchNonJson('<html><body>Bad Gateway</body></html>', 502, 'Bad Gateway');
    await expect(apiGet('/api/proxy')).rejects.toThrow(ApiError);
    await expect(apiGet('/api/proxy')).rejects.toMatchObject({
      status: 502,
    });
  });

  it('includes content-type hint for non-JSON error responses', async () => {
    mockFetchNonJson('Internal Server Error', 503, 'Service Unavailable');
    try {
      await apiGet('/api/unavailable');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(503);
      expect((err as ApiError).message).toContain('text/html');
    }
  });

  it('throws with status for non-OK JSON responses without error envelope', async () => {
    mockFetch({ unexpected: 'shape' }, false, 500);
    await expect(apiGet('/api/bad')).rejects.toThrow(ApiError);
    await expect(apiGet('/api/bad')).rejects.toMatchObject({
      status: 500,
    });
  });
});
