// src/lib/__tests__/apiClient.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, ApiError } from '@/lib/apiClient';

// Helper to mock fetch responses
function mockFetch(response: any, ok = true, status = 200) {
  (global as any).fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(response),
    })
  );
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
      message: 'Not found',
    });
  });

  it('throws timeout error when request aborts', async () => {
    // Simulate abort by returning a never-resolving promise; the api client will abort after timeout.
    (global as any).fetch = vi.fn(() => new Promise(() => {}));
    await expect(apiGet('/api/slow', 10)).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });
});
