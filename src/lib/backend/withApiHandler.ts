import { NextRequest } from "next/server";
import { fail, getCorrelationId } from "./apiResponse";
import { applyCorsPolicy, enforceCorsRequestPolicy, type CorsRoutePolicy } from "./cors";
import { ApiError } from "./errors";
import { logError, logWarn } from "./logger";

type RouteHandler = (
  req: NextRequest,
  context: { params: Record<string, string> },
  correlationId: string,
) => Response | Promise<Response>;

interface ApiHandlerOptions {
  cors?: CorsRoutePolicy;
}

function finalizeResponse(
  req: NextRequest,
  response: Response,
  correlationId: string,
  cors?: CorsRoutePolicy,
): Response {
  if (!response.headers.has("x-correlation-id")) {
    response.headers.set("x-correlation-id", correlationId);
  }
  if (!response.headers.has("x-request-id")) {
    response.headers.set("x-request-id", correlationId);
  }

  return cors ? applyCorsPolicy(req, response, cors) : response;
}

export function withApiHandler(
  handler: RouteHandler,
  options: ApiHandlerOptions = {},
): RouteHandler {
  return async function wrappedHandler(
    req: NextRequest,
    context: { params: Record<string, string> } = { params: {} },
  ): Promise<Response> {
    const correlationId = getCorrelationId(req);

    try {
      if (options.cors) {
        enforceCorsRequestPolicy(req, options.cors);
      }

      const response = await handler(req, context, correlationId);
      return finalizeResponse(req, response, correlationId, options.cors);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        logWarn(req, "[API] Handled error", {
          correlationId,
          code: err.code,
          status: err.statusCode,
          message: err.message,
          url: req.url,
          method: req.method,
        });

        const response = fail(
          err.code,
          err.message,
          err.details,
          err.statusCode,
          err.retryAfterSeconds,
          correlationId,
        );
        return finalizeResponse(req, response, correlationId, options.cors);
      }

      const error = err instanceof Error ? err : new Error(String(err));

      logError(req, "[API] Unhandled exception", error, {
        correlationId,
        url: req.url,
        method: req.method,
      });

      const response = fail(
        "INTERNAL_ERROR",
        "An unexpected error occurred. Please try again later.",
        undefined,
        500,
        correlationId,
      );
      return finalizeResponse(req, response, correlationId, options.cors);
    }
  };
}
