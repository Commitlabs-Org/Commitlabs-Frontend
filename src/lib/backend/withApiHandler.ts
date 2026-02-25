import { NextRequest, NextResponse } from 'next/server';
import { logWarn, logError } from './logger';
import { fail } from './apiResponse';
import { ApiError } from './errors';

type RouteHandler = (
    req: NextRequest,
    context: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * withApiHandler
 *
 * Wraps a Next.js App Router route handler so that:
 *  - Known `ApiError` subclasses are converted into clean JSON error responses
 *    at the appropriate HTTP status code.
 *  - Unknown errors are logged and converted into generic 500 responses.
 *
 * @example
 * ```ts
 * // app/api/commitments/route.ts
 * import { withApiHandler } from '@/lib/backend/withApiHandler';
 * import { ok } from '@/lib/backend/apiResponse';
 *
 * export const GET = withApiHandler(async (req) => {
 *   const commitments = await getCommitments();
 *   return ok(commitments);
 * });
 * ```
 */
export function withApiHandler(handler: RouteHandler): RouteHandler {
    return async function wrappedHandler(
        req: NextRequest,
        context: { params: Record<string, string> }
    ): Promise<NextResponse> {
        try {
            return await handler(req, context);
        } catch (err: unknown) {
            if (err instanceof ApiError) {
                logWarn(req, '[API] Handled error', {
                    code: err.code,
                    status: err.statusCode,
                    message: err.message,
                    url: req.url,
                    method: req.method,
                });

                return fail(err.message, err.code, err.statusCode, err.details);
            }

            const error = err instanceof Error ? err : new Error(String(err));

            logError(req, '[API] Unhandled exception', error, {
                url: req.url,
                method: req.method,
            });

            return fail(
                'An unexpected error occurred. Please try again later.',
                'INTERNAL_ERROR',
                500
            );
        }
    };
}