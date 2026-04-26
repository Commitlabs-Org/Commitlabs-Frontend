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
  HTTP_ERROR_CODES,
} from './errors';

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
    expect(error.message).toBe('Too many requests. Please try again later.');
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
    expect(error.message).toBe('The service is temporarily unavailable. Please try again later.');
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

describe('HTTP_ERROR_CODES', () => {
  it('should include 429 with TOO_MANY_REQUESTS', () => {
    expect(HTTP_ERROR_CODES[429]).toBe('TOO_MANY_REQUESTS');
  });

  it('should include 503 with SERVICE_UNAVAILABLE', () => {
    expect(HTTP_ERROR_CODES[503]).toBe('SERVICE_UNAVAILABLE');
  });

  it('should include all standard error codes', () => {
    expect(HTTP_ERROR_CODES[400]).toBe('BAD_REQUEST');
    expect(HTTP_ERROR_CODES[401]).toBe('UNAUTHORIZED');
    expect(HTTP_ERROR_CODES[403]).toBe('FORBIDDEN');
    expect(HTTP_ERROR_CODES[404]).toBe('NOT_FOUND');
    expect(HTTP_ERROR_CODES[409]).toBe('CONFLICT');
    expect(HTTP_ERROR_CODES[500]).toBe('INTERNAL_ERROR');
    expect(HTTP_ERROR_CODES[502]).toBe('BAD_GATEWAY');
    expect(HTTP_ERROR_CODES[504]).toBe('GATEWAY_TIMEOUT');
  });
});
