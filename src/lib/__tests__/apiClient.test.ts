import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from '@/lib/apiClient';

// Helper to mock fetch responses
function mockFetch(response: any, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => response,
  } as Response));
}

function mockFetchReject(errorMessage: string) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(errorMessage)));
}

function mockFetchAbort() {
  const abortError = new DOMException('Aborted', 'AbortError');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns data on successful ok response', async () => {
    const data = { hello: 'world' };
    const envelope = { success: true, data };
    mockFetch(envelope);
    const result = await apiFetch<{ hello: string }>('/api/test');
    expect(result).toEqual(data);
  });

  it('throws ApiError with backend error details', async () => {
    const envelope = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
        details: { resource: 'test' },
        retryAfterSeconds: 30,
        correlationId: 'abc123',
      },
    };
    mockFetch(envelope, false, 404);
    await expect(apiFetch('/api/notfound')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'NOT_FOUND',
      message: 'Not found',
      details: { resource: 'test' },
      retryAfterSeconds: 30,
      correlationId: 'abc123',
    } as ApiError);
  });

  it('throws ApiError on timeout (abort)', async () => {
    mockFetchAbort();
    await expect(apiFetch('/api/timeout')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'TIMEOUT',
    } as ApiError);
  });

  it('throws ApiError on network error', async () => {
    mockFetchReject('Network failure');
    await expect(apiFetch('/api/network')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'NETWORK_ERROR',
      message: 'Network failure',
    } as ApiError);
  });
});
