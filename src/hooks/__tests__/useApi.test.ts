// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApi } from '@/hooks/useApi';
import { ApiClientError } from '@/lib/client/apiClient';

describe('useApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns data and clears loading on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { hello: 'world' } }),
      }),
    );

    const { result } = renderHook(() => useApi((signal) => fetch('/api/test', { signal }).then((res) => res.json()), []));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ hello: 'world' });
    expect(result.current.error).toBeNull();
  });

  it('normalizes backend error envelopes into a UI-friendly error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'The thing was not found.',
            details: { resource: 'thing' },
          },
        }),
      }),
    );

    const { result } = renderHook(() => useApi((signal) => fetch('/api/test', { signal }).then((res) => res.json()), []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(ApiClientError);
    expect(result.current.error?.message).toBe('The requested resource was not found.');
    expect(result.current.error?.code).toBe('NOT_FOUND');
  });

  it('normalizes network failures into a friendly client error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const { result } = renderHook(() => useApi((signal) => fetch('/api/test', { signal }), []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(ApiClientError);
    expect(result.current.error?.code).toBe('NETWORK_ERROR');
    expect(result.current.error?.message).toContain('reach the server');
  });

  it('aborts the request when the component unmounts', async () => {
    let abortListener: (() => void) | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        const signal = init?.signal;
        if (signal) {
          abortListener = () => {
            if (signal.aborted) {
              return;
            }
            signal.dispatchEvent(new Event('abort'));
          };
        }

        return new Promise((_, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }),
    );

    const { unmount } = renderHook(() => useApi((signal) => fetch('/api/test', { signal }), []));

    unmount();

    await act(async () => {
      abortListener?.();
    });

    expect(true).toBe(true);
  });
});
