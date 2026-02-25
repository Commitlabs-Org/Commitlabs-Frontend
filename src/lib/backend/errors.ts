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

  return new BackendError({
    ...fallback,
    cause: error
  });
}

export function toBackendErrorResponse(error: BackendError): BackendErrorResponseBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    }
  };
}
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

export class NotFoundError extends ApiError {
    constructor(resource = 'Resource', details?: unknown) {
        super(`${resource} not found.`, 'NOT_FOUND', 404, details);
        this.name = 'NotFoundError';
    }
}

export class ValidationError extends ApiError {
    constructor(message = 'Invalid request data.', details?: unknown) {
        super(message, 'VALIDATION_ERROR', 400, details);
        this.name = 'ValidationError';
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message = 'Authentication required.', details?: unknown) {
        super(message, 'UNAUTHORIZED', 401, details);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends ApiError {
    constructor(message = 'You do not have permission to perform this action.', details?: unknown) {
        super(message, 'FORBIDDEN', 403, details);
        this.name = 'ForbiddenError';
    }
}

export class ConflictError extends ApiError {
    constructor(message = 'A conflict occurred.', details?: unknown) {
        super(message, 'CONFLICT', 409, details);
        this.name = 'ConflictError';
    }
}

export class TooManyRequestsError extends ApiError {
    constructor(message = 'Too many requests. Please try again later.', details?: unknown) {
        super(message, 'TOO_MANY_REQUESTS', 429, details);
        this.name = 'TooManyRequestsError';
    }
}
