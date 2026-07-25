import { useEffect, useRef, useState } from 'react';
import { ApiClientError, apiRequest, parseApiResponse } from '@/lib/client/apiClient';
import { normalizeApiError } from '@/utils/errorHelpers';

export interface UseApiResult<T> {
  data: T | null;
  error: ApiClientError | null;
  loading: boolean;
}

export function useApi<T>(
  request: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [loading, setLoading] = useState(true);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    activeRequestRef.current?.abort();
    activeRequestRef.current = controller;

    let cancelled = false;
    setLoading(true);
    setError(null);

    request(controller.signal)
      .then((result) => {
        if (!cancelled && !controller.signal.aborted) {
          const parsed = parseApiResponse(result);
          setData(parsed as T);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && !controller.signal.aborted) {
          const normalized = err instanceof ApiClientError
            ? new ApiClientError(normalizeApiError(err, err.status))
            : new ApiClientError(normalizeApiError(err));

          setError(normalized);
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled && !controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, deps);

  return { data, error, loading };
}

export function useApiClient<T>(
  url: string,
  init?: RequestInit,
  deps: unknown[] = [],
): UseApiResult<T> {
  return useApi<T>((signal) => apiRequest<T>(url, { ...init, signal }, {}), deps);
}
