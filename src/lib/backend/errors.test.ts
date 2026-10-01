import { describe, it, expect } from 'vitest';
import {
  ApiError,
  TooManyRequestsError,
  ServiceUnavailableError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError,
  BackendError,
  normalizeBackendError,
} from './errors';
import { ERROR_CODE_REGISTRY } from './errorCodes';

describe('ApiError', () => {
  it('should store all constructor arguments', () => {
    const error = new ApiError('test message', 'TEST_CODE', 418, { foo: 'bar' }, 45);
    expect(error.message).toBe('test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(418);
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.retryAfterSeconds).toBe(45);
  });

  it('should have name ApiError', () => {
    expect(new ApiError('msg', 'CODE', 500).name).toBe('ApiError');
  });

  it('should be instanceof Error', () => {
    expect(new ApiError('msg', 'CODE', 500)).toBeInstanceOf(Error);
  });
});

describe('TooManyRequestsError', () => {
  it('should default retryAfterSeconds to 60', () => {
    const error = new TooManyRequestsError();
    expect(error.retryAfterSeconds).toBe(60);
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('TOO_MANY_REQUESTS');
    expect(error.message).toBe(ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.meaning);
  });

  it('should accept custom message, details, and retryAfterSeconds', () => {
    const error = new TooManyRequestsError('Slow down.', { ip: '1.2.3.4' }, 30);
    expect(error.message).toBe('Slow down.');
    expect(error.details).toEqual({ ip: '1.2.3.4' });
    expect(error.retryAfterSeconds).toBe(30);
  });

  it('should have correct name', () => {
    expect(new TooManyRequestsError().name).toBe('TooManyRequestsError');
  });

  it('should be instanceof ApiError', () => {
    expect(new TooManyRequestsError()).toBeInstanceOf(ApiError);
  });

  it('should use 0 as retryAfterSeconds when explicitly passed', () => {
    const error = new TooManyRequestsError('slow', undefined, 0);
    expect(error.retryAfterSeconds).toBe(0);
  });
});

describe('ServiceUnavailableError', () => {
  it('should default retryAfterSeconds to 30', () => {
    const error = new ServiceUnavailableError();
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(error.message).toBe(ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.meaning);
  });

  it('should accept custom message, details, and retryAfterSeconds', () => {
    const error = new ServiceUnavailableError('Maintenance window.', { window: '02:00' }, 120);
    expect(error.message).toBe('Maintenance window.');
    expect(error.details).toEqual({ window: '02:00' });
    expect(error.retryAfterSeconds).toBe(120);
  });

  it('should have correct name', () => {
    expect(new ServiceUnavailableError().name).toBe('ServiceUnavailableError');
  });

  it('should be instanceof ApiError', () => {
    expect(new ServiceUnavailableError()).toBeInstanceOf(ApiError);
  });
});

describe('InternalError', () => {
  it('should use the registry meaning as the default message', () => {
    expect(new InternalError().message).toBe(ERROR_CODE_REGISTRY.INTERNAL_ERROR.meaning);
  });
});

describe('Other error classes — no retryAfter', () => {
  it.each([
    ['BadRequestError', new BadRequestError()],
    ['ValidationError', new ValidationError()],
    ['UnauthorizedError', new UnauthorizedError()],
    ['ForbiddenError', new ForbiddenError()],
    ['NotFoundError', new NotFoundError()],
    ['ConflictError', new ConflictError()],
    ['InternalError', new InternalError()],
  ])('%s should not have retryAfterSeconds', (_, error) => {
    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it.each([
    ['BadRequestError', new BadRequestError(), 400, 'BAD_REQUEST'],
    ['ValidationError', new ValidationError(), 400, 'VALIDATION_ERROR'],
    ['UnauthorizedError', new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    ['ForbiddenError', new ForbiddenError(), 403, 'FORBIDDEN'],
    ['NotFoundError', new NotFoundError(), 404, 'NOT_FOUND'],
    ['ConflictError', new ConflictError(), 409, 'CONFLICT'],
    ['InternalError', new InternalError(), 500, 'INTERNAL_ERROR'],
  ])('%s should have correct status and code', (_, error, status, code) => {
    expect(error.statusCode).toBe(status);
    expect(error.code).toBe(code);
  });
});

describe('HTTP_ERROR_CODES removal', () => {
  it('no longer exports the deprecated HTTP status map', async () => {
    const errorsModule = await import('./errors');

    expect('HTTP_ERROR_CODES' in errorsModule).toBe(false);
  });

  it('keeps ERROR_CODE_REGISTRY as the single error-code source of truth', async () => {
    const errorsModule = await import('./errors');

    expect(errorsModule.ERROR_CODE_REGISTRY).toBe(ERROR_CODE_REGISTRY);
  });
});

describe('normalizeBackendError', () => {
  it.each([
    ['TOO_MANY_REQUESTS', 429],
    ['INTERNAL_ERROR', 500],
    ['BAD_GATEWAY', 502],
    ['SERVICE_UNAVAILABLE', 503],
    ['GATEWAY_TIMEOUT', 504],
  ] as const)('%s uses registry retry semantics', (code, status) => {
    const normalized = normalizeBackendError(
      new BackendError({ code, message: 'Server error', status }),
      {
        code: 'BLOCKCHAIN_CALL_FAILED',
        message: 'Fallback message',
        status: 500,
      },
    );

    expect(normalized.details?.retryable).toBe(ERROR_CODE_REGISTRY[code].retriable);
  });

  it('should classify timeout errors as GATEWAY_TIMEOUT and retryable', () => {
    const normalized = normalizeBackendError(new Error('RPC Timeout'), {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Fallback message',
      status: 502,
    });

    expect(normalized).toBeInstanceOf(BackendError);
    expect(normalized.code).toBe('GATEWAY_TIMEOUT');
    expect(normalized.status).toBe(504);
    expect(normalized.message).toContain('timed out');
    expect(normalized.details).toEqual({ retryable: true });
  });

  it('should classify rate-limit errors as TOO_MANY_REQUESTS and retryable', () => {
    const normalized = normalizeBackendError(new Error('429 Too Many Requests'), {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Fallback message',
      status: 502,
    });

    expect(normalized.code).toBe('TOO_MANY_REQUESTS');
    expect(normalized.status).toBe(429);
    expect(normalized.details).toEqual({ retryable: true });
  });

  it('should preserve fallback details and add retryable flag for existing BackendError status', () => {
    const original = new BackendError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limited',
      status: 429,
      details: { limit: 100 },
    });

    const normalized = normalizeBackendError(original, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Fallback message',
      status: 502,
      details: { method: 'test' },
    });

    expect(normalized).toBeInstanceOf(BackendError);
    expect(normalized.code).toBe('TOO_MANY_REQUESTS');
    expect(normalized.status).toBe(429);
    expect(normalized.details).toEqual({ limit: 100, method: 'test', retryable: true });
  });
});
