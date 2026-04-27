import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

type NextRouteHandler = (
  req: NextRequest,
  ctx?: unknown,
) => NextResponse | Promise<NextResponse>;

export interface OkResponse<T> {
  success: true;
  data: T;
  meta?: {
    correlationId?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

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

export function getCorrelationId(req: NextRequest): string {
  return (
    req.headers.get("x-correlation-id") ??
    req.headers.get("x-request-id") ??
    randomBytes(16).toString("hex")
  );
}

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

  const meta =
    correlationId || resolvedMeta
      ? {
          ...(correlationId ? { correlationId } : {}),
          timestamp: new Date().toISOString(),
          ...(resolvedMeta ?? {}),
        }
      : undefined;

  const response = NextResponse.json<OkResponse<T>>(
    {
      success: true,
      data,
      ...(meta ? { meta } : {}),
    },
    { status: resolvedStatus },
  );

  if (correlationId) {
    response.headers.set("x-correlation-id", correlationId);
    response.headers.set("x-request-id", correlationId);
  }

  return response;
}

export function methodNotAllowed(allowed: string[]): NextRouteHandler {
  const allowHeader = allowed.join(", ");
  return (): NextResponse<FailResponse> =>
    NextResponse.json(
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
  retryAfterOrCorrelationId?: number | string,
  correlationIdArg?: string,
): NextResponse<FailResponse> {
  const retryAfterSeconds =
    typeof retryAfterOrCorrelationId === "number"
      ? retryAfterOrCorrelationId
      : undefined;
  const correlationId =
    typeof retryAfterOrCorrelationId === "string"
      ? retryAfterOrCorrelationId
      : correlationIdArg;

  const response = NextResponse.json<FailResponse>(
    {
      success: false,
      error: {
        code,
        message,
        ...(correlationId ? { correlationId } : {}),
        timestamp: new Date().toISOString(),
        ...(details !== undefined ? { details } : {}),
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      },
    },
    {
      status,
      headers:
        retryAfterSeconds !== undefined
          ? { "Retry-After": String(retryAfterSeconds) }
          : undefined,
    },
  );

  if (correlationId) {
    response.headers.set("x-correlation-id", correlationId);
    response.headers.set("x-request-id", correlationId);
  }

  return response;
}
