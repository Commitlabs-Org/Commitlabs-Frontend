import { NextResponse } from "next/server";

// ─── Success shape ────────────────────────────────────────────────────────────

export interface OkResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

// ─── Error shape ──────────────────────────────────────────────────────────────

export interface FailResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    retryAfterSeconds?: number;
  };
}

export type ApiResponse<T> = OkResponse<T> | FailResponse;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a standard JSON success response.
 *
 * @example
 * return ok({ status: 'healthy' });
 * // { success: true, data: { status: 'healthy' } }
 *
 * @example
 * return ok(items, { total: 42, page: 1 });
 * // { success: true, data: [...], meta: { total: 42, page: 1 } }
 *
 * @example
 * return ok(data, 201);  // custom HTTP status, no meta
 */
export function ok<T>(
  data: T,
  metaOrStatus?: Record<string, unknown> | number,
  status = 200,
): NextResponse<OkResponse<T>> {
  let resolvedMeta: Record<string, unknown> | undefined;
  let resolvedStatus = status;

  if (typeof metaOrStatus === "number") {
    resolvedStatus = metaOrStatus;
  } else {
    resolvedMeta = metaOrStatus;
  }

  const body: OkResponse<T> =
    resolvedMeta !== undefined
      ? { success: true, data, meta: resolvedMeta }
      : { success: true, data };
  return NextResponse.json(body, { status: resolvedStatus });
}

/**
 * Returns a standard JSON error response.
 *
 * @param code              - Short machine-readable error code, e.g. 'NOT_FOUND'
 * @param message           - Human-readable description safe for UI display
 * @param details           - Optional extra context (omit in production for sensitive errors)
 * @param status            - HTTP status code (default 500)
 * @param retryAfterSeconds - Optional seconds the client should wait before retrying
 *
 * @example
 * return fail('NOT_FOUND', 'Commitment not found.', undefined, 404);
 * // { success: false, error: { code: 'NOT_FOUND', message: 'Commitment not found.' } }
 *
 * @example
 * return fail('TOO_MANY_REQUESTS', 'Rate limit exceeded.', undefined, 429, 60);
 * // { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded.', retryAfterSeconds: 60 } }
 */
export function fail(
  code: string,
  message: string,
  details?: unknown,
  status = 500,
  retryAfterSeconds?: number,
): NextResponse<FailResponse> {
  const body: FailResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    },
  };

  const headers: HeadersInit = {};
  if (retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }

  return NextResponse.json(body, {
    status,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
}
