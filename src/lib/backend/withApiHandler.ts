import { NextRequest, NextResponse } from 'next/server';
import { logWarn, logError } from './logger';
import { fail, getCorrelationId } from './apiResponse';
import { ApiError } from './errors';

type RouteHandler = (
    req: NextRequest,
    context: { params: Record<string, string> },
    correlationId: string
) => Promise<NextResponse>;

/**
 * withApiHandler
 *
 * Wraps a Next.js App Router route handler so that:
 *  - Automatically extracts or generates correlation IDs
 *  - Known `ApiError` subclasses are converted into clean JSON error responses
 *    at the appropriate HTTP status code with correlation IDs
 *  - Unknown errors are logged and converted into generic 500 responses
 *  - Enforces unified API response contract across all routes
 *
 * @example
 * ```ts
 * // src/app/api/commitments/route.ts
 * import { withApiHandler } from '@/lib/backend/withApiHandler';
 * import { ok } from '@/lib/backend/apiResponse';
 *
 * export const GET = withApiHandler(async (req, context, correlationId) => {
 *   const commitments = await getCommitments();
 *   return ok(commitments, undefined, 200, correlationId);
 * });
 * ```
 */
export function withApiHandler(handler: RouteHandler): RouteHandler {
    return async function wrappedHandler(
        req: NextRequest,
        context: { params: Record<string, string> }
    ): Promise<NextResponse> {
        // Extract or generate correlation ID
        const correlationId = getCorrelationId(req);
        
        try {
            const response = await handler(req, context, correlationId);
            
            // Ensure correlation ID is present in response headers
            if (!response.headers.has('x-correlation-id')) {
                response.headers.set('x-correlation-id', correlationId);
            }
            
            return response;
        } catch (err: unknown) {
            if (err instanceof ApiError) {
                logWarn(req, '[API] Handled error', {
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
                );
                response.headers.set('x-request-id', requestId);
                return response;
            }

            const error = err instanceof Error ? err : new Error(String(err));

            logError(req, '[API] Unhandled exception', error, {
                correlationId,
                url: req.url,
                method: req.method,
            });

            const response = fail(
                'INTERNAL_ERROR',
                'An unexpected error occurred. Please try again later.',
                undefined,
                500,
                correlationId
            );

            response.headers.set('x-request-id', requestId);
            return response;
        }
    };
}
