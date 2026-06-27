import { ApiResponse, OkResponse, FailResponse } from '@/lib/backend/apiResponse';

/**
 * Typed error thrown by apiFetch.
 */
export class ApiError extends Error {
  /** Backend error code */
  code: string;
  /** Optional additional details */
  details?: unknown;
  /** Optional retry after seconds */
  retryAfterSeconds?: number;
  /** Correlation identifier from backend */
  correlationId?: string;
  constructor(
    code: string,
    message: string,
    details?: unknown,
    retryAfterSeconds?: number,
    correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
    this.correlationId = correlationId;
  }
}

/**
 * Generic fetch wrapper that parses the standard API response envelope.
 * It aborts the request after `timeoutMs` (default 10 000 ms).
 *
 * @param url - endpoint URL (relative or absolute)
 * @param options - fetch init options
 * @param timeoutMs - timeout in milliseconds
 * @returns the `data` field of a successful response
 * @throws {ApiError} on network failure, timeout, or backend error envelope
 */
export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const json = await response.json();
    // The backend always returns { success: true/false, ... }
    const envelope: ApiResponse<T> = json;
    if (envelope.success) {
      const ok = envelope as OkResponse<T>;
      return ok.data;
    }
    const fail = envelope as FailResponse;
    const { code, message, details, retryAfterSeconds, correlationId } = fail.error;
    throw new ApiError(code, message, details, retryAfterSeconds, correlationId);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('TIMEOUT', `Request timed out after ${timeoutMs} ms`);
    }
    if (e instanceof ApiError) {
      throw e;
    }
    throw new ApiError('NETWORK_ERROR', (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
