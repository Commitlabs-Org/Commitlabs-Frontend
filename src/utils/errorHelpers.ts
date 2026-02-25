// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
    success: false;
    error: {
        code: number;
        type: string;
        message: string;
        retryAfter?: number;
        details?: string;
    };
}

// ─── Error Factories ──────────────────────────────────────────────────────────


export function rateLimitError(retryAfter = 60, details?: string): ApiErrorResponse {
    return {
        success: false,
        error: {
        code: 429,
        type: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please wait before trying again.",
        retryAfter,
        ...(details && process.env.NODE_ENV === "development" ? { details } : {}),
        },
    };
}


export function internalServerError(details?: string): ApiErrorResponse {
    return {
        success: false,
        error: {
        code: 500,
        type: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
        ...(details && process.env.NODE_ENV === "development" ? { details } : {}),
        },
    };
}


export function badGatewayError(details?: string): ApiErrorResponse {
    return {
        success: false,
        error: {
        code: 502,
        type: "BAD_GATEWAY",
        message: "A upstream service returned an invalid response. Please try again later.",
        ...(details && process.env.NODE_ENV === "development" ? { details } : {}),
        },
    };
}


export function serviceUnavailableError(retryAfter = 30, details?: string): ApiErrorResponse {
    return {
        success: false,
        error: {
        code: 503,
        type: "SERVICE_UNAVAILABLE",
        message: "The service is temporarily unavailable. Please try again later.",
        retryAfter,
        ...(details && process.env.NODE_ENV === "development" ? { details } : {}),
        },
    };
}


export function gatewayTimeoutError(details?: string): ApiErrorResponse {
    return {
        success: false,
        error: {
        code: 504,
        type: "GATEWAY_TIMEOUT",
        message: "The request timed out. Please try again.",
        ...(details && process.env.NODE_ENV === "development" ? { details } : {}),
        },
    };
}

// ─── Generic 5xx Resolver ─────────────────────────────────────────────────────

export function resolveServerError(statusCode: number, details?: string): ApiErrorResponse {
    switch (statusCode) {
        case 502:
        return badGatewayError(details);
        case 503:
        return serviceUnavailableError(30, details);
        case 504:
        return gatewayTimeoutError(details);
        default:
        return internalServerError(details);
    }
}

// ─── HTTP Headers Helper ──────────────────────────────────────────────────────

export function getErrorHeaders(error: ApiErrorResponse): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (error.error.retryAfter !== undefined) {
        headers["Retry-After"] = String(error.error.retryAfter);
    }

    return headers;
}