// src/lib/apiClient.ts

/**
 * Shared typed fetch client for frontend API calls.
 * It enforces a request timeout, parses the standard response envelope,
 * and throws a typed {@link ApiError} on failure.
 */

import { ApiResponse, OkResponse, FailResponse } from '@/lib/backend/apiResponse';
import { OkBodySchema, ErrorBodySchema } from '@/lib/schemas/apiContracts';
import { z } from 'zod';

/** Typed error that mirrors the backend error envelope. */
export class ApiError extends Error {
  /** Machine‑readable error code (e.g. NOT_FOUND, VALIDATION_ERROR). */
  public readonly code: string;
  /** Optional additional details payload. */
  public readonly details?: unknown;
  /** Optional retry‑after seconds hint. */
  public readonly retryAfterSeconds?: number;
  /** Correlation id for tracing across services. */
  public readonly correlationId?: string;

  constructor({
    code,
    message,
    details,
    retryAfterSeconds,
    correlationId,
  }: {
    code: string;
    message: string;
    details?: unknown;
    retryAfterSeconds?: number;
    correlationId?: string;
  }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
    this.correlationId = correlationId;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Low‑level fetch wrapper that returns the concrete `data` payload on success.
 * On failure it throws {@link ApiError} with the properties extracted from the
 * error envelope.
 *
 * @param url Endpoint relative or absolute URL.
 * @param init Optional {@link RequestInit} passed to `fetch`.
 * @param timeoutMs Timeout in milliseconds (default 5000 ms).
 */
export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 5000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeout);

    const json = await response.json();

    // Try to parse an error envelope first.
    try {
      const err = ErrorBodySchema.parse(json);
      throw new ApiError({
        code: err.error.code,
        message: err.error.message,
        details: err.error.details,
        retryAfterSeconds: (err.error as any).retryAfterSeconds,
        correlationId: (err.error as any).correlationId,
      });
    } catch {
      // Not an error envelope.
    }

    // Parse as a success envelope – we accept any data shape.
    const successSchema = OkBodySchema(z.any());
    const ok = successSchema.parse(json) as OkResponse<T>;
    return ok.data;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError({
        code: 'TIMEOUT',
        message: `Request timed out after ${timeoutMs} ms`,
      });
    }
    throw err;
  }
}

/** Convenience GET wrapper. */
export function apiGet<T>(url: string, timeoutMs?: number): Promise<T> {
  return apiFetch<T>(url, { method: 'GET' }, timeoutMs);
}

/** Convenience POST wrapper. */
export function apiPost<T>(url: string, body: unknown, timeoutMs?: number): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs);
}

/** Convenience PUT wrapper. */
export function apiPut<T>(url: string, body: unknown, timeoutMs?: number): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs);
}

/** Convenience DELETE wrapper. */
export function apiDelete<T>(url: string, timeoutMs?: number): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE' }, timeoutMs);
}
