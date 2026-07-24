import { z } from 'zod';
import { ErrorBodySchema, OkBodySchema } from '@/lib/schemas/apiContracts';
import { normalizeApiError, type UiApiError } from '@/utils/errorHelpers';
import type { FailResponse, OkResponse } from '@/lib/backend/apiResponse';

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly details?: unknown;
  public readonly retryAfterSeconds?: number;
  public readonly correlationId?: string;
  public readonly friendlyMessage: string;

  constructor(error: UiApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.status = error.status;
    this.details = error.details;
    this.retryAfterSeconds = error.retryAfterSeconds;
    this.correlationId = error.correlationId;
    this.friendlyMessage = error.message;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiClientError);
    }
  }
}

export class ApiError extends ApiClientError {}

function isErrorEnvelope(value: unknown): value is FailResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<FailResponse> & Record<string, unknown>;
  const hasFailure = candidate.success === false || candidate.ok === false;
  const hasErrorShape = typeof candidate.error?.code === 'string' && typeof candidate.error?.message === 'string';
  return hasFailure && hasErrorShape;
}

function isSuccessEnvelope(value: unknown): value is OkResponse<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<OkResponse<unknown>> & Record<string, unknown>;
  const hasSuccess = candidate.success === true || candidate.ok === true;
  return hasSuccess && ('data' in candidate || 'result' in candidate);
}

export function parseApiResponse<T>(payload: unknown): T {
  if (isErrorEnvelope(payload)) {
    const parsed = ErrorBodySchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiError(
        normalizeApiError(
          {
            code: parsed.data.error.code,
            message: parsed.data.error.message,
            details: parsed.data.error.details,
          },
          500,
        ),
      );
    }
  }

  if (isSuccessEnvelope(payload)) {
    const record = payload as Record<string, unknown>;
    if ('data' in record) {
      return record.data as T;
    }

    const parsed = OkBodySchema(z.any()).safeParse(payload);
    if (parsed.success) {
      return parsed.data.data as T;
    }
  }

  return payload as T;
}

export async function apiRequest<T>(
  input: string | URL | Request,
  init?: RequestInit,
  options?: { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const controller = new AbortController();
  const externalSignal = init?.signal;

  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  const abortPromise = new Promise<never>((_, reject) => {
    const onAbort = () => {
      controller.abort();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        onAbort();
        return;
      }
      externalSignal.addEventListener('abort', onAbort, { once: true });
    }

    controller.signal.addEventListener('abort', onAbort, { once: true });
  });

  try {
    const response = await Promise.race([
      fetch(input, { ...init, signal: controller.signal }),
      abortPromise,
    ]);
    clearTimeout(timeoutId);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      if (isErrorEnvelope(payload)) {
        throw new ApiError(
          normalizeApiError(
            {
              code: payload.error.code,
              message: payload.error.message,
              details: payload.error.details,
              retryAfterSeconds: payload.error.retryAfterSeconds,
              correlationId: payload.error.correlationId,
            },
            response.status,
          ),
        );
      }

      throw new ApiError(
        normalizeApiError(
          new Error(`Request failed with status ${response.status}`),
          response.status,
        ),
      );
    }

    return parseApiResponse<T>(payload);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError({
        code: 'TIMEOUT',
        message: 'The request was cancelled.',
        status: 0,
      });
    }

    throw new ApiError(normalizeApiError(error));
  }
}

export function apiGet<T>(url: string, initOrTimeout?: RequestInit | number, timeoutMs = 5000): Promise<T> {
  if (typeof initOrTimeout === 'number') {
    return apiRequest<T>(url, { method: 'GET' }, { timeoutMs: initOrTimeout });
  }

  return apiRequest<T>(url, { method: 'GET', ...(initOrTimeout ?? {}) }, { timeoutMs });
}

export function apiPost<T>(url: string, body: unknown, timeoutMs = 5000): Promise<T> {
  return apiRequest<T>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { timeoutMs },
  );
}

export function apiPut<T>(url: string, body: unknown, timeoutMs = 5000): Promise<T> {
  return apiRequest<T>(
    url,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { timeoutMs },
  );
}

export function apiDelete<T>(url: string, timeoutMs = 5000): Promise<T> {
  return apiRequest<T>(url, { method: 'DELETE' }, { timeoutMs });
}
