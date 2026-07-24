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

export interface UiApiError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
  retryAfterSeconds?: number;
  correlationId?: string;
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
        message: "An upstream service returned an invalid response. Please try again later.",
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

export function normalizeApiError(error: unknown, status?: number): UiApiError {
  const maybeErrorLike = error as Partial<UiApiError> & { code?: string; message?: string };
  const codeFromError = typeof maybeErrorLike?.code === 'string' ? maybeErrorLike.code : undefined;
  const messageFromError = typeof maybeErrorLike?.message === 'string' ? maybeErrorLike.message : undefined;
  const inboundMessage = messageFromError || (error instanceof Error ? error.message : undefined) || 'Something went wrong.';
  const lower = inboundMessage.toLowerCase();

  const code = codeFromError?.toUpperCase() ||
    (lower.includes('fetch') || lower.includes('network') ? 'NETWORK_ERROR' : undefined) ||
    (lower.includes('timeout') || lower.includes('aborted') ? 'TIMEOUT' : undefined) ||
    (lower.includes('not found') ? 'NOT_FOUND' : undefined) ||
    (lower.includes('unauthorized') ? 'UNAUTHORIZED' : undefined) ||
    (lower.includes('forbidden') ? 'FORBIDDEN' : undefined) ||
    (lower.includes('rate limit') ? 'RATE_LIMIT_EXCEEDED' : undefined) ||
    'REQUEST_FAILED';

  if (code === 'NETWORK_ERROR') {
    return {
      code,
      message: 'We could not reach the server. Please try again.',
      status,
    };
  }

  if (code === 'TIMEOUT') {
    return {
      code,
      message: 'The request took too long. Please try again.',
      status,
    };
  }

  if (code === 'NOT_FOUND') {
    return {
      code,
      message: 'The requested resource was not found.',
      status,
    };
  }

  if (code === 'UNAUTHORIZED') {
    return {
      code,
      message: 'You are not authorized to perform that action.',
      status,
    };
  }

  if (code === 'FORBIDDEN') {
    return {
      code,
      message: 'You do not have permission to do that.',
      status,
    };
  }

  if (code === 'RATE_LIMIT_EXCEEDED') {
    return {
      code,
      message: 'Too many requests. Please wait before trying again.',
      status,
    };
  }

  return {
    code,
    message: inboundMessage,
    status,
  };
}
