import { NextRequest, NextResponse } from "next/server";
import { attachSecurityHeaders, fail, getCorrelationId } from "./apiResponse";
import { applyCorsPolicy, enforceCorsRequestPolicy, type CorsRoutePolicy } from "./cors";
import { ApiError } from "./errors";
import { logError, logWarn } from "./logger";
import { generateETag, etagMatches } from "./etag";

type RouteHandler = (
  req: NextRequest,
  context: { params: Record<string, string> },
  correlationId: string,
) => Response | Promise<Response>;

interface ApiHandlerOptions {
  cors?: CorsRoutePolicy;
  enableETag?: boolean;
  /**
   * Controls the Cache-Control privacy directive emitted on ETag responses.
   * Use 'public' only for routes whose data is identical for all users (e.g.
   * static reference data). Routes returning user-specific data (wallet lists,
   * preferences, etc.) must use 'private' so shared caches/CDNs cannot serve
   * one user's response to another.
   *
   * Defaults to 'private'.
   */
  cachePrivacy?: "public" | "private";
  /**
   * Controls the security headers (CSP/X-Frame-Options/HSTS/etc.) applied to
   * every response this handler produces. By default all responses get
   * attachSecurityHeaders() with the default CSP ("default-src 'self'").
   *
   * - csp: override the Content-Security-Policy directive string for routes
   *   that need different rules (e.g. allowing an image CDN, or a looser
   *   policy for a login/redirect flow).
   * - skip: opt out of security headers entirely. Should be rare — prefer
   *   `csp` over `skip` wherever possible.
   */
  security?: {
    csp?: string;
    skip?: boolean;
  };
}

function finalizeResponse(
  req: NextRequest,
  response: Response,
  correlationId: string,
  options: ApiHandlerOptions,
): Response {
  if (!response.headers.has("x-correlation-id")) {
    response.headers.set("x-correlation-id", correlationId);
  }
  if (!response.headers.has("x-request-id")) {
    response.headers.set("x-request-id", correlationId);
  }

  if (!options.security?.skip) {
    response = attachSecurityHeaders(response, options.security?.csp);
  }

  return options.cors ? applyCorsPolicy(req, response, options.cors) : response;
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
      
      // Handle conditional requests with ETag
      if (options.enableETag && response.status === 200) {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json().catch(() => null);
        
        if (data) {
          const etag = generateETag(data);
          const ifNoneMatch = req.headers.get("if-none-match");
          const privacy = options.cachePrivacy ?? "private";
          const cacheControl = `${privacy}, max-age=0, must-revalidate`;
          
          if (etagMatches(ifNoneMatch, etag)) {
            // Return 304 Not Modified
            const notModifiedResponse = new NextResponse(null, { status: 304 });
            notModifiedResponse.headers.set("ETag", etag);
            notModifiedResponse.headers.set("Cache-Control", cacheControl);
            return finalizeResponse(req, notModifiedResponse, correlationId, options);
          }
          
          // Add ETag to successful response
          response.headers.set("ETag", etag);
          response.headers.set("Cache-Control", cacheControl);
        }
      }
      
      return finalizeResponse(req, response, correlationId, options);
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
        return finalizeResponse(req, response, correlationId, options);
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
      return finalizeResponse(req, response, correlationId, options);
    }
  };
}
