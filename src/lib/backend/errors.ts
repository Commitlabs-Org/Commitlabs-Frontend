/**
 * Error handling module.
 *
 * Defines typed error classes that correspond to HTTP status codes.
 * Each error class maps to a definition in the centralized error code registry.
 *
 * @see errorCodes.ts for the centralized error code registry and documentation
 */

import { ERROR_CODE_REGISTRY } from "./errorCodes";

// ─── Base API error ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Named subclasses ─────────────────────────────────────────────────────────

/** 400 — malformed or invalid request input. */
export class BadRequestError extends ApiError {
  constructor(message = "Bad request.", details?: unknown) {
    super(message, "BAD_REQUEST", 400, details);
    this.name = "BadRequestError";
  }
}

/** 400 — request body / query params failed validation. */
export class ValidationError extends ApiError {
  constructor(message = "Invalid request data.", details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

/** 401 — missing or invalid authentication credentials. */
export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required.", details?: unknown) {
    super(message, "UNAUTHORIZED", 401, details);
    this.name = "UnauthorizedError";
  }
}

/** 403 — authenticated but not permitted to perform the action. */
export class ForbiddenError extends ApiError {
  constructor(
    message = "You do not have permission to perform this action.",
    details?: unknown,
  ) {
    super(message, "FORBIDDEN", 403, details);
    this.name = "ForbiddenError";
  }
}

/** 403 — CSRF token missing, invalid, or cross-site request when using cookie session. */
export class CsrfValidationError extends ApiError {
    constructor(message = 'Invalid or missing CSRF token.', details?: unknown) {
        super(message, 'CSRF_INVALID', 403, details);
        this.name = 'CsrfValidationError';
    }
}

/** 404 — requested resource does not exist. */
export class NotFoundError extends ApiError {
  constructor(resource = "Resource", details?: unknown) {
    super(`${resource} not found.`, "NOT_FOUND", 404, details);
    this.name = "NotFoundError";
  }
}

/** 409 — request conflicts with current state (e.g. duplicate). */
export class ConflictError extends ApiError {
  constructor(message = "A conflict occurred.", details?: unknown) {
    super(message, "CONFLICT", 409, details);
    this.name = "ConflictError";
  }
}

/** 413 — request entity is larger than the server is willing to process. */
export class PayloadTooLargeError extends ApiError {
  constructor(message = "Request body is too large.", details?: unknown) {
    super(message, "PAYLOAD_TOO_LARGE", 413, details);
    this.name = "PayloadTooLargeError";
  }
}

/** 429 — client has exceeded the allowed request rate. */
export class TooManyRequestsError extends ApiError {
  constructor(
    message = "Too many requests. Please try again later.",
    details?: unknown,
    retryAfterSeconds = 60,
  ) {
    super(message, "TOO_MANY_REQUESTS", 429, details, retryAfterSeconds);
    this.name = "TooManyRequestsError";
  }
}

/** 503 — service is temporarily unavailable. */
export class ServiceUnavailableError extends ApiError {
  constructor(
    message = "The service is temporarily unavailable. Please try again later.",
    details?: unknown,
    retryAfterSeconds = 30,
  ) {
    super(message, "SERVICE_UNAVAILABLE", 503, details, retryAfterSeconds);
    this.name = "ServiceUnavailableError";
  }
}

/** 500 — unexpected server-side failure. */
export class InternalError extends ApiError {
  constructor(
    message = "An unexpected error occurred. Please try again later.",
    details?: unknown,
  ) {
    super(message, "INTERNAL_ERROR", 500, details);
    this.name = "InternalError";
  }
}

// ─── HTTP status → error code mapping ───────────────────────────────────────

/**
 * Map of HTTP status codes to their canonical error code strings.
 *
 * @deprecated Use ERROR_CODE_REGISTRY from errorCodes.ts for detailed error
 * documentation including meaning, client handling, and retriable status.
 *
 * @see ERROR_CODE_REGISTRY
 */
export const HTTP_ERROR_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

// ─── Legacy BackendError (kept for backward compatibility) ────────────────────

export type BackendErrorCode =
  | "BAD_REQUEST"
  | "NOT_MATURED"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "TOO_MANY_REQUESTS"
  | "SERVICE_UNAVAILABLE"
  | "GATEWAY_TIMEOUT"
  | "BLOCKCHAIN_UNAVAILABLE"
  | "BLOCKCHAIN_CALL_FAILED"
  | "INTERNAL_ERROR";

export interface BackendErrorOptions {
  code: BackendErrorCode;
  message: string;
  status: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class BackendError extends Error {
  readonly code: BackendErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(options: BackendErrorOptions) {
    super(options.message);
    this.name = "BackendError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export interface BackendErrorResponseBody {
  error: {
    code: BackendErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function isBackendError(value: unknown): value is BackendError {
  return value instanceof BackendError;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function isRetryableStatus(status: number): boolean {
  return [429, 503, 504].includes(status);
}

function classifyBackendError(
  error: unknown,
):
  | {
      code: BackendErrorCode;
      status: number;
      message: string;
      retryable: boolean;
    }
  | undefined {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errStr = errMessage.toLowerCase();

  if (
    errStr.includes("timeout") ||
    errStr.includes("deadline") ||
    errStr.includes("timed out")
  ) {
    return {
      code: "GATEWAY_TIMEOUT",
      status: 504,
      message:
        "The blockchain operation timed out. It may still be processed later.",
      retryable: true,
    };
  }

  if (
    errStr.includes("429") ||
    errStr.includes("rate limit") ||
    errStr.includes("too many requests")
  ) {
    return {
      code: "TOO_MANY_REQUESTS",
      status: 429,
      message: "Rate limit exceeded for blockchain calls. Please try again later.",
      retryable: true,
    };
  }

  if (
    errStr.includes("503") ||
    errStr.includes("service unavailable") ||
    errStr.includes("temporarily unavailable")
  ) {
    return {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      message: "Blockchain service is temporarily unavailable. Please try again later.",
      retryable: true,
    };
  }

  if (errStr.includes("not found") || errStr.includes("404")) {
    return {
      code: "NOT_FOUND",
      status: 404,
      message: "The requested resource was not found on the blockchain.",
      retryable: false,
    };
  }

  if (
    errStr.includes("insufficient") ||
    errStr.includes("invalid") ||
    errStr.includes("malformed")
  ) {
    return {
      code: "VALIDATION_ERROR",
      status: 400,
      message:
        "The transaction was rejected due to invalid parameters or state.",
      retryable: false,
    };
  }

  return undefined;
}

export function normalizeBackendError(
  error: unknown,
  fallback: Omit<BackendErrorOptions, "cause">,
): BackendError {
  if (isBackendError(error)) {
    const details = {
      ...asRecord(error.details),
      ...asRecord(fallback.details),
    };
    const retryable =
      asRecord(error.details).retryable === true ||
      isRetryableStatus(error.status);

    return new BackendError({
      code: error.code,
      message: error.message,
      status: error.status,
      details: {
        ...details,
        retryable,
      },
      cause: error,
    });
  }

  const classified =
    fallback.code === "BLOCKCHAIN_CALL_FAILED"
      ? classifyBackendError(error)
      : undefined;

  const status = classified?.status ?? fallback.status;
  const code = classified?.code ?? fallback.code;
  const message = classified?.message ?? fallback.message;
  const retryable = classified?.retryable ?? isRetryableStatus(fallback.status);

  return new BackendError({
    code,
    message,
    status,
    details: {
      ...asRecord(fallback.details),
      retryable,
    },
    cause: error,
  });
}

export function toBackendErrorResponse(
  error: BackendError,
): BackendErrorResponseBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}

// ─── Error code registry exports ──────────────────────────────────────────────

/**
 * Re-export error code registry utilities for easy access throughout the application.
 *
 * @see errorCodes.ts for full registry and documentation
 */
export {
  ERROR_CODE_REGISTRY,
  getErrorCodeDefinition,
  getErrorCodesByStatus,
  validateErrorCodeRegistry,
  type ErrorCodeDefinition,
  type RegisteredErrorCode,
} from "./errorCodes";
