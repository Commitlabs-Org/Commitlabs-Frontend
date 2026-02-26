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
  };
}

export type ApiResponse<T> = OkResponse<T> | FailResponse;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a standard JSON success response.
 *
 * @example
 * return ok({ status: 'healthy' });
 * // { ok: true, data: { status: 'healthy' } }
 *
 * @example
 * return ok(items, { total: 42, page: 1 });
 * // { ok: true, data: [...], meta: { total: 42, page: 1 } }
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
 * @param code    - Short machine-readable error code, e.g. 'NOT_FOUND'
 * @param message - Human-readable description safe for UI display
 * @param details - Optional extra context (omit in production for sensitive errors)
 * @param status  - HTTP status code (default 500)
 *
 * @example
 * return fail('NOT_FOUND', 'Commitment not found.', undefined, 404);
 * // { ok: false, error: { code: 'NOT_FOUND', message: 'Commitment not found.' } }
 */
export function fail(
  code: string,
  message: string,
  details?: unknown,
  status = 500,
): NextResponse<FailResponse> {
  const body: FailResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  return NextResponse.json(body, { status });
}
