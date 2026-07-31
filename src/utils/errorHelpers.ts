import { ERROR_CODE_REGISTRY } from '../lib/backend/errorCodes';

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

/**
 * Creates an ApiErrorResponse for 429 Rate Limit Exceeded.
 * Default message and status code are sourced from ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.
 */
export function rateLimitError(retryAfter = 60, details?: string): ApiErrorResponse {
  const registryEntry = ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS!;
  return {
    success: false,
    error: {
      code: registryEntry.statusCode,
      type: 'RATE_LIMIT_EXCEEDED',
      message: registryEntry.meaning,
      retryAfter,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
  };
}

/**
 * Creates an ApiErrorResponse for 500 Internal Server Error.
 * Default message and status code are sourced from ERROR_CODE_REGISTRY.INTERNAL_ERROR.
 */
export function internalServerError(details?: string): ApiErrorResponse {
  const registryEntry = ERROR_CODE_REGISTRY.INTERNAL_ERROR!;
  return {
    success: false,
    error: {
      code: registryEntry.statusCode,
      type: 'INTERNAL_SERVER_ERROR',
      message: registryEntry.meaning,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
  };
}

/**
 * Creates an ApiErrorResponse for 502 Bad Gateway.
 * Default message and status code are sourced from ERROR_CODE_REGISTRY.BAD_GATEWAY.
 */
export function badGatewayError(details?: string): ApiErrorResponse {
  const registryEntry = ERROR_CODE_REGISTRY.BAD_GATEWAY!;
  return {
    success: false,
    error: {
      code: registryEntry.statusCode,
      type: 'BAD_GATEWAY',
      message: registryEntry.meaning,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
  };
}

/**
 * Creates an ApiErrorResponse for 503 Service Unavailable.
 * Default message and status code are sourced from ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.
 */
export function serviceUnavailableError(retryAfter = 30, details?: string): ApiErrorResponse {
  const registryEntry = ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE!;
  return {
    success: false,
    error: {
      code: registryEntry.statusCode,
      type: 'SERVICE_UNAVAILABLE',
      message: registryEntry.meaning,
      retryAfter,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
  };
}

/**
 * Creates an ApiErrorResponse for 504 Gateway Timeout.
 * Default message and status code are sourced from ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.
 */
export function gatewayTimeoutError(details?: string): ApiErrorResponse {
  const registryEntry = ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT!;
  return {
    success: false,
    error: {
      code: registryEntry.statusCode,
      type: 'GATEWAY_TIMEOUT',
      message: registryEntry.meaning,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
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
    'Content-Type': 'application/json',
  };

  if (error.error.retryAfter !== undefined) {
    headers['Retry-After'] = String(error.error.retryAfter);
  }

  return headers;
}

export function normalizeApiError(error: unknown, status?: number): UiApiError {
  const maybeErrorLike = error as Partial<UiApiError> & { code?: string; message?: string };
  const codeFromError = typeof maybeErrorLike?.code === 'string' ? maybeErrorLike.code : undefined;
  const messageFromError =
    typeof maybeErrorLike?.message === 'string' ? maybeErrorLike.message : undefined;
  const inboundMessage =
    messageFromError ||
    (error instanceof Error ? error.message : undefined) ||
    'Something went wrong.';
  const lower = inboundMessage.toLowerCase();

  const code =
    codeFromError?.toUpperCase() ||
    (lower.includes('fetch') || lower.includes('network') ? 'NETWORK_ERROR' : undefined) ||
    (lower.includes('timeout') || lower.includes('aborted') ? 'TIMEOUT' : undefined) ||
    (lower.includes('not found') ? 'NOT_FOUND' : undefined) ||
    (lower.includes('unauthorized') ? 'UNAUTHORIZED' : undefined) ||
    (lower.includes('forbidden') ? 'FORBIDDEN' : undefined) ||
    (lower.includes('rate limit') ? 'RATE_LIMIT_EXCEEDED' : undefined) ||
    'REQUEST_FAILED';

  const message =
    code === 'NETWORK_ERROR'
      ? 'We could not reach the server. Please try again.'
      : code === 'TIMEOUT'
        ? 'The request took too long. Please try again.'
        : code === 'NOT_FOUND'
          ? 'The requested resource was not found.'
          : code === 'UNAUTHORIZED'
            ? 'You are not authorized to perform that action.'
            : code === 'FORBIDDEN'
              ? 'You do not have permission to do that.'
              : code === 'RATE_LIMIT_EXCEEDED'
                ? 'Too many requests. Please wait before trying again.'
                : inboundMessage;

  // Only attach optional fields when they are actually defined, to satisfy
  // `exactOptionalPropertyTypes` (no explicit `undefined` on optional props).
  const result: UiApiError = { code, message };
  if (status !== undefined) {
    result.status = status;
  }
  if (maybeErrorLike?.details !== undefined) {
    result.details = maybeErrorLike.details;
  }
  if (maybeErrorLike?.retryAfterSeconds !== undefined) {
    result.retryAfterSeconds = maybeErrorLike.retryAfterSeconds;
  }
  if (maybeErrorLike?.correlationId !== undefined) {
    result.correlationId = maybeErrorLike.correlationId;
  }
  return result;
}
