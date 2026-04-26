import { NextRequest, NextResponse } from "next/server";

/** Route handler type accepted by Next.js App Router */
type NextRouteHandler = (
  req: NextRequest,
  ctx?: unknown,
) => NextResponse | Promise<NextResponse>;

// ─── Success shape ────────────────────────────────────────────────────────────

export interface OkResponse<T> {
  success: true;
  data: T;
  meta?: {
    correlationId?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

// ─── Error shape ──────────────────────────────────────────────────────────────

export interface FailResponse {
  success: false;
  error: {
    code: string;
    message: string;
    correlationId?: string;
    timestamp?: string;
    details?: unknown;
    retryAfterSeconds?: number;
  };
}

export type ApiResponse<T> = OkResponse<T> | FailResponse;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a standard JSON success response with correlation ID.
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
 * return ok(data, undefined, 201);  // custom HTTP status, no meta
 */
export function ok<T>(
  data: T,
  metaOrStatus?: Record<string, unknown> | number,
  status = 200,
  correlationId?: string,
): NextResponse<OkResponse<T>> {
  let resolvedMeta: Record<string, unknown> | undefined;
  let resolvedStatus = status;

  if (typeof metaOrStatus === "number") {
    resolvedStatus = metaOrStatus;
  } else {
    resolvedMeta = metaOrStatus;
  }

  const timestamp = new Date().toISOString();
  const responseMeta: Record<string, unknown> = {
    correlationId,
    timestamp,
    ...resolvedMeta,
  };

  const body: OkResponse<T> = {
    success: true,
    data,
    meta: Object.keys(responseMeta).length > 0 ? responseMeta : undefined,
  };
  
  const response = NextResponse.json(body, { status: resolvedStatus });
  
  // Add correlation ID to response headers for tracing
  if (correlationId) {
    response.headers.set('x-correlation-id', correlationId);
  }
  
  return response;
}

/**
 * Returns a standard JSON error response with correlation ID.
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
/**
 * Returns a Next.js route handler that responds with 405 Method Not Allowed.
 * The `Allow` response header is set to the comma-joined list of supported methods,
 * and the body follows the project's standard `{ success, error }` shape.
 *
 * @param allowed - HTTP methods supported by the route, e.g. `['GET', 'POST']`
 *
 * @example
 * // In a GET-only route:
 * const _405 = methodNotAllowed(['GET']);
 * export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
 */
export function methodNotAllowed(allowed: string[]): NextRouteHandler {
  const allowHeader = allowed.join(", ");
  return (): NextResponse<FailResponse> =>
    NextResponse.json<FailResponse>(
      {
        success: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: `Method Not Allowed. Supported methods: ${allowHeader}`,
        },
      },
      {
        status: 405,
        headers: { Allow: allowHeader },
      },
    );
}

export function fail(
  code: string,
  message: string,
  details?: unknown,
  status = 500,
  retryAfterSeconds?: number,
): NextResponse<FailResponse> {
  const timestamp = new Date().toISOString();
  
  const body: FailResponse = {
    success: false,
    error: {
      code,
      message,
      correlationId,
      timestamp,
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

export function methodNotAllowed(allowed: string[]): NextRouteHandler {
  const allowHeader = allowed.join(", ");
  return (): NextResponse<FailResponse> =>
    NextResponse.json<FailResponse>(
      {
        success: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: `Method Not Allowed. Supported methods: ${allowHeader}`,
        },
      },
      { status: 405, headers: { Allow: allowHeader } },
    );
}
