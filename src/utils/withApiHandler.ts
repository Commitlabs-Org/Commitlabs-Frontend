
import { NextRequest, NextResponse } from "next/server";
import {
    rateLimitError,
    resolveServerError,
    getErrorHeaders,
    ApiErrorResponse,
} from "./errorHelpers";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiHandler = (req: NextRequest) => Promise<NextResponse>;

// ─── Custom Error Classes ─────────────────────────────────────────────────────

export class RateLimitError extends Error {
    public retryAfter: number;

    constructor(retryAfter = 60) {
        super("Rate limit exceeded");
        this.name = "RateLimitError";
        this.retryAfter = retryAfter;
    }
}

export class ServerError extends Error {
    public statusCode: number;

    constructor(statusCode = 500, message = "Internal server error") {
        super(message);
        this.name = "ServerError";
        this.statusCode = statusCode;
    }
}

// ─── withApiHandler ───────────────────────────────────────────────────────────


export function withApiHandler(handler: ApiHandler): ApiHandler {
    return async (req: NextRequest): Promise<NextResponse> => {
        try {
        return await handler(req);

        } catch (err: unknown) {

        // ── 429 Rate Limit ──────────────────────────────────────────────────────
        if (err instanceof RateLimitError) {
            const errorBody: ApiErrorResponse = rateLimitError(err.retryAfter);
            const headers = getErrorHeaders(errorBody);

            console.warn(`[429] Rate limit triggered on ${req.nextUrl.pathname}`);

            return NextResponse.json(errorBody, {
            status: 429,
            headers,
            });
        }

        // ── 5xx Server Errors ───────────────────────────────────────────────────
        if (err instanceof ServerError) {
            const errorBody: ApiErrorResponse = resolveServerError(
            err.statusCode,
            err.message
            );
            const headers = getErrorHeaders(errorBody);

            console.error(
            `[${err.statusCode}] Server error on ${req.nextUrl.pathname}:`,
            err.message
            );

            return NextResponse.json(errorBody, {
            status: err.statusCode,
            headers,
            });
        }

        // ── Unknown / Unexpected Errors ─────────────────────────────────────────
        const unknownMessage =
            err instanceof Error ? err.message : "Unknown error";

        console.error(
            `[500] Unhandled error on ${req.nextUrl.pathname}:`,
            unknownMessage
        );

        const errorBody: ApiErrorResponse = resolveServerError(500, unknownMessage);
        const headers = getErrorHeaders(errorBody);

        return NextResponse.json(errorBody, {
            status: 500,
            headers,
        });
        }
    };
}