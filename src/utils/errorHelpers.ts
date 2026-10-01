import { ERROR_CODE_REGISTRY } from '../lib/backend/errorCodes';

/**
 * Standard API error response structure.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: number;
    type: string;
    message: string;
    retriable: boolean;
    retryAfter?: number;
    details?: string;
  };
}

/**
 * Normalized UI error representation for client consumption.
 */
export interface UiApiError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
  retryAfterSeconds?: number;
  correlationId?: string;
}

/**
 * Creates an ApiErrorResponse for 429 Rate Limit Exceeded.
 * Status code, default message, and retriability are sourced from ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.
 *
 * @param retryAfter Number of seconds client should wait before retrying. Defaults to 60.
 * @param details Optional debug details included only in development mode.
 * @returns ApiErrorResponse structure for 429 responses.
 */
export function rateLimitError(retryAfter = 60, details?: string): ApiErrorResponse {
  const registryEntry = ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS;
  return {
    success: false,
    error: {
      code: registryEntry.statusCode,
      type: 'RATE_LIMIT_EXCEEDED',
      message: registryEntry.meaning,
      retriable: registryEntry.retriable,
      retryAfter,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
  };
}

/**
 * Creates an ApiErrorResponse for 500 Internal Server Error.
 * Status code, default message, and retriability are sourced from ERROR_CODE_REGISTRY.INTERNAL_ERROR.
 *
 * @param details Optional debug details included only in development mode.
 * @returns ApiErrorResponse structure for 500 responses.
 */
export function internalServerError(details?: string): ApiErrorResponse {
  const registryEntry = ERROR_CODE_REGISTRY.INTERNAL_ERROR;
  return {
    success: false,
    error: {
      code: registryEntry.statusCode,
      type: 'INTERNAL_SERVER_ERROR',
      message: registryEntry.meaning,
      retriable: registryEntry.retriable,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
  };
}

/**
 * Creates an ApiErrorResponse for 502 Bad Gateway.
 * Status code, default message, and retriability are sourced from ERROR_CODE_REGISTRY.BAD_GATEWAY.
 *
 * @param details Optional debug details included only in development mode.
 * @returns ApiErrorResponse structure for 502 responses.
 */
export function badGatewayError(details?: string): ApiErrorResponse {
  const registryEntry = ERROR_CODE_REGISTRY.BAD_GATEWAY;
  return {
    success: false,
    error: {
      code: registryEntry.statusCode,
      type: 'BAD_GATEWAY',
      message: registryEntry.meaning,
      retriable: registryEntry.retriable,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
  };
}

/**
 * Creates an ApiErrorResponse for 503 Service Unavailable.
 * Status code, default message, and retriability are sourced from ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.
 *
 * @param retryAfter Number of seconds client should wait before retrying. Defaults to 30.
 * @param details Optional debug details included only in development mode.
 * @returns ApiErrorResponse structure for 503 responses.
 */
export function serviceUnavailableError(retryAfter = 30, details?: string): ApiErrorResponse {
  const registryEntry = ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE;
  return {
    success: false,
    error: {
      code: registryEntry.statusCode,
      type: 'SERVICE_UNAVAILABLE',
      message: registryEntry.meaning,
      retriable: registryEntry.retriable,
      retryAfter,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
  };
}

/**
 * Creates an ApiErrorResponse for 504 Gateway Timeout.
 * Status code, default message, and retriability are sourced from ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.
 *
 * @param details Optional debug details included only in development mode.
 * @returns ApiErrorResponse structure for 504 responses.
 */
export function gatewayTimeoutError(details?: string): ApiErrorResponse {
  const registryEntry = ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT;
  return {
    success: false,
    error: {
      code: registryEntry.statusCode,
      type: 'GATEWAY_TIMEOUT',
      message: registryEntry.meaning,
      retriable: registryEntry.retriable,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
  };
}

/**
 * Resolves a server HTTP status code (5xx) to the corresponding ApiErrorResponse.
 * Status codes 502, 503, and 504 map to specific error factories. Other status codes
 * default to internalServerError.
 *
 * @param statusCode HTTP status code.
 * @param details Optional debug details included only in development mode.
 * @returns ApiErrorResponse structure corresponding to the status code.
 */
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

/**
 * Checks whether an HTTP status code represents a retriable error as catalogued in ERROR_CODE_REGISTRY.
 *
 * @param statusCode HTTP status code.
 * @returns True if the status code corresponds to a retriable error in the registry.
 */
export function isServerErrorRetriable(statusCode: number): boolean {
  switch (statusCode) {
    case 429:
      return ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.retriable;
    case 500:
      return ERROR_CODE_REGISTRY.INTERNAL_ERROR.retriable;
    case 502:
      return ERROR_CODE_REGISTRY.BAD_GATEWAY.retriable;
    case 503:
      return ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.retriable;
    case 504:
      return ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.retriable;
    default:
      return false;
  }
}

/**
 * Generates standard HTTP headers for an ApiErrorResponse.
 *
 * @param error The ApiErrorResponse object.
 * @returns Record of HTTP response headers.
 */
export function getErrorHeaders(error: ApiErrorResponse): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (error.error.retryAfter !== undefined) {
    headers['Retry-After'] = String(error.error.retryAfter);
  }

  return headers;
}

/**
 * Normalizes an unknown or frontend error into a standardized UiApiError.
 *
 * @param error Error value thrown or returned.
 * @param status Optional HTTP status code.
 * @returns Standardized UiApiError object.
 */
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
    (lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted') ||
    status === 504 ||
    status === 408
      ? 'TIMEOUT'
      : undefined) ||
    (lower.includes('not found') || status === 404 ? 'NOT_FOUND' : undefined) ||
    (lower.includes('unauthorized') || status === 401 ? 'UNAUTHORIZED' : undefined) ||
    (lower.includes('forbidden') || status === 403 ? 'FORBIDDEN' : undefined) ||
    (lower.includes('rate limit') || status === 429 ? 'RATE_LIMIT_EXCEEDED' : undefined) ||
    'REQUEST_FAILED';

  const passthrough = {
    details: maybeErrorLike?.details,
    retryAfterSeconds: maybeErrorLike?.retryAfterSeconds,
    correlationId: maybeErrorLike?.correlationId,
  };

  if (code === 'NETWORK_ERROR') {
    return {
      code,
      message: 'We could not reach the server. Please try again.',
      status,
      ...passthrough,
    };
  }

  if (code === 'TIMEOUT') {
    return {
      code,
      message: 'The request took too long. Please try again.',
      status,
      ...passthrough,
    };
  }

  if (code === 'NOT_FOUND') {
    return {
      code,
      message: 'The requested resource was not found.',
      status,
      ...passthrough,
    };
  }

  if (code === 'UNAUTHORIZED') {
    return {
      code,
      message: 'You are not authorized to perform that action.',
      status,
      ...passthrough,
    };
  }

  if (code === 'FORBIDDEN') {
    return {
      code,
      message: 'You do not have permission to do that.',
      status,
      ...passthrough,
    };
  }

  if (code === 'RATE_LIMIT_EXCEEDED') {
    return {
      code,
      message: 'Too many requests. Please wait before trying again.',
      status,
      ...passthrough,
    };
  }

  return {
    code,
    message: inboundMessage,
    status,
    ...passthrough,
  };
}
