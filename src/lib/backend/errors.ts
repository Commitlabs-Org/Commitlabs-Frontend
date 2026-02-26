// ─── Base API error ───────────────────────────────────────────────────────────

export class ApiError extends Error {
    constructor(
        public readonly message: string,
        public readonly code: string,
        public readonly statusCode: number,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// ─── Named subclasses ─────────────────────────────────────────────────────────

/** 400 — malformed or invalid request input. */
export class BadRequestError extends ApiError {
    constructor(message = 'Bad request.', details?: unknown) {
        super(message, 'BAD_REQUEST', 400, details);
        this.name = 'BadRequestError';
    }
}

/** 400 — request body / query params failed validation. */
export class ValidationError extends ApiError {
    constructor(message = 'Invalid request data.', details?: unknown) {
        super(message, 'VALIDATION_ERROR', 400, details);
        this.name = 'ValidationError';
    }
}

/** 401 — missing or invalid authentication credentials. */
export class UnauthorizedError extends ApiError {
    constructor(message = 'Authentication required.', details?: unknown) {
        super(message, 'UNAUTHORIZED', 401, details);
        this.name = 'UnauthorizedError';
    }
}

/** 403 — authenticated but not permitted to perform the action. */
export class ForbiddenError extends ApiError {
    constructor(message = 'You do not have permission to perform this action.', details?: unknown) {
        super(message, 'FORBIDDEN', 403, details);
        this.name = 'ForbiddenError';
    }
}

/** 404 — requested resource does not exist. */
export class NotFoundError extends ApiError {
    constructor(resource = 'Resource', details?: unknown) {
        super(`${resource} not found.`, 'NOT_FOUND', 404, details);
        this.name = 'NotFoundError';
    }
}

/** 409 — request conflicts with current state (e.g. duplicate). */
export class ConflictError extends ApiError {
    constructor(message = 'A conflict occurred.', details?: unknown) {
        super(message, 'CONFLICT', 409, details);
        this.name = 'ConflictError';
    }
}

/** 429 — client has exceeded the allowed request rate. */
export class TooManyRequestsError extends ApiError {
    constructor(message = 'Too many requests. Please try again later.', details?: unknown) {
        super(message, 'TOO_MANY_REQUESTS', 429, details);
        this.name = 'TooManyRequestsError';
    }
}

/** 500 — unexpected server-side failure. */
export class InternalError extends ApiError {
    constructor(message = 'An unexpected error occurred. Please try again later.', details?: unknown) {
        super(message, 'INTERNAL_ERROR', 500, details);
        this.name = 'InternalError';
    }
}

// ─── HTTP status → error code mapping ────────────────────────────────────────

/** Map of HTTP status codes to their canonical error code strings. */
export const HTTP_ERROR_CODES: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT',
};

// ─── Legacy BackendError (kept for backward compatibility) ────────────────────

export type BackendErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'BLOCKCHAIN_UNAVAILABLE'
  | 'BLOCKCHAIN_CALL_FAILED'
  | 'INTERNAL_ERROR';

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
    this.name = 'BackendError';
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

export function normalizeBackendError(
  error: unknown,
  fallback: Omit<BackendErrorOptions, 'cause'>
): BackendError {
  if (isBackendError(error)) {
    return error;
  }
  return new BackendError({ ...fallback, cause: error });
}

export function toBackendErrorResponse(error: BackendError): BackendErrorResponseBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}
