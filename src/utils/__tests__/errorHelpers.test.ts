import { describe, it, expect, afterEach } from 'vitest';
import {
  rateLimitError,
  internalServerError,
  badGatewayError,
  serviceUnavailableError,
  gatewayTimeoutError,
  resolveServerError,
  isServerErrorRetriable,
  getErrorHeaders,
  normalizeApiError,
} from '../errorHelpers';
import { ERROR_CODE_REGISTRY } from '../../lib/backend/errorCodes';

const originalEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
});

describe('ERROR_CODE_REGISTRY consistency', () => {
  it('sources default message, status code, and retriability for rateLimitError from ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS', () => {
    const result = rateLimitError();
    expect(result.error.code).toBe(ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.statusCode);
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.meaning);
    expect(result.error.retriable).toBe(ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.retriable);
  });

  it('sources default message, status code, and retriability for internalServerError from ERROR_CODE_REGISTRY.INTERNAL_ERROR', () => {
    const result = internalServerError();
    expect(result.error.code).toBe(ERROR_CODE_REGISTRY.INTERNAL_ERROR.statusCode);
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.INTERNAL_ERROR.meaning);
    expect(result.error.retriable).toBe(ERROR_CODE_REGISTRY.INTERNAL_ERROR.retriable);
  });

  it('sources default message, status code, and retriability for badGatewayError from ERROR_CODE_REGISTRY.BAD_GATEWAY', () => {
    const result = badGatewayError();
    expect(result.error.code).toBe(ERROR_CODE_REGISTRY.BAD_GATEWAY.statusCode);
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.BAD_GATEWAY.meaning);
    expect(result.error.retriable).toBe(ERROR_CODE_REGISTRY.BAD_GATEWAY.retriable);
  });

  it('sources default message, status code, and retriability for serviceUnavailableError from ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE', () => {
    const result = serviceUnavailableError();
    expect(result.error.code).toBe(ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.statusCode);
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.meaning);
    expect(result.error.retriable).toBe(ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.retriable);
  });

  it('sources default message, status code, and retriability for gatewayTimeoutError from ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT', () => {
    const result = gatewayTimeoutError();
    expect(result.error.code).toBe(ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.statusCode);
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.meaning);
    expect(result.error.retriable).toBe(ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.retriable);
  });

  it.each([
    [429, ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.retriable],
    [500, ERROR_CODE_REGISTRY.INTERNAL_ERROR.retriable],
    [502, ERROR_CODE_REGISTRY.BAD_GATEWAY.retriable],
    [503, ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.retriable],
    [504, ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.retriable],
  ])(
    'isServerErrorRetriable(%i) matches registry retriability of %s',
    (statusCode, expectedRetriable) => {
      expect(isServerErrorRetriable(statusCode)).toBe(expectedRetriable);
    },
  );

  it('isServerErrorRetriable returns false for unmapped or non-server status codes', () => {
    expect(isServerErrorRetriable(400)).toBe(false);
    expect(isServerErrorRetriable(404)).toBe(false);
    expect(isServerErrorRetriable(200)).toBe(false);
  });
});

describe('rateLimitError', () => {
  it('returns code 429 and correct type, message, and retriability', () => {
    const result = rateLimitError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(429);
    expect(result.error.type).toBe('RATE_LIMIT_EXCEEDED');
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.TOO_MANY_REQUESTS.meaning);
    expect(result.error.retriable).toBe(true);
  });

  it('defaults retryAfter to 60', () => {
    const result = rateLimitError();
    expect(result.error.retryAfter).toBe(60);
  });

  it('accepts a custom retryAfter value', () => {
    const result = rateLimitError(120);
    expect(result.error.retryAfter).toBe(120);
  });

  it('includes details in development when provided', () => {
    process.env.NODE_ENV = 'development';
    const result = rateLimitError(60, '10 requests per minute limit reached');
    expect(result.error.details).toBe('10 requests per minute limit reached');
  });

  it('omits details in production', () => {
    process.env.NODE_ENV = 'production';
    const result = rateLimitError(60, '10 requests per minute limit reached');
    expect(result.error.details).toBeUndefined();
  });

  it('omits details when not provided', () => {
    process.env.NODE_ENV = 'development';
    const result = rateLimitError();
    expect(result.error.details).toBeUndefined();
  });
});

describe('internalServerError', () => {
  it('returns code 500 and correct type, message, and retriability', () => {
    const result = internalServerError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(500);
    expect(result.error.type).toBe('INTERNAL_SERVER_ERROR');
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.INTERNAL_ERROR.meaning);
    expect(result.error.retriable).toBe(true);
  });

  it('includes details in development when provided', () => {
    process.env.NODE_ENV = 'development';
    const result = internalServerError('database connection error');
    expect(result.error.details).toBe('database connection error');
  });

  it('omits details in production', () => {
    process.env.NODE_ENV = 'production';
    const result = internalServerError('database connection error');
    expect(result.error.details).toBeUndefined();
  });

  it('omits details when not provided', () => {
    process.env.NODE_ENV = 'development';
    const result = internalServerError();
    expect(result.error.details).toBeUndefined();
  });
});

describe('badGatewayError', () => {
  it('returns code 502 and correct type, message, and retriability', () => {
    const result = badGatewayError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(502);
    expect(result.error.type).toBe('BAD_GATEWAY');
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.BAD_GATEWAY.meaning);
    expect(result.error.retriable).toBe(true);
  });

  it('includes details in development when provided', () => {
    process.env.NODE_ENV = 'development';
    const result = badGatewayError('upstream timeout');
    expect(result.error.details).toBe('upstream timeout');
  });

  it('omits details in production', () => {
    process.env.NODE_ENV = 'production';
    const result = badGatewayError('upstream timeout');
    expect(result.error.details).toBeUndefined();
  });
});

describe('serviceUnavailableError', () => {
  it('returns code 503 and correct type, message, and retriability', () => {
    const result = serviceUnavailableError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(503);
    expect(result.error.type).toBe('SERVICE_UNAVAILABLE');
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.meaning);
    expect(result.error.retriable).toBe(true);
  });

  it('defaults retryAfter to 30', () => {
    const result = serviceUnavailableError();
    expect(result.error.retryAfter).toBe(30);
  });

  it('accepts a custom retryAfter value', () => {
    const result = serviceUnavailableError(90);
    expect(result.error.retryAfter).toBe(90);
  });

  it('includes details in development when provided', () => {
    process.env.NODE_ENV = 'development';
    const result = serviceUnavailableError(30, 'maintenance window');
    expect(result.error.details).toBe('maintenance window');
  });

  it('omits details in production', () => {
    process.env.NODE_ENV = 'production';
    const result = serviceUnavailableError(30, 'maintenance window');
    expect(result.error.details).toBeUndefined();
  });
});

describe('gatewayTimeoutError', () => {
  it('returns code 504 and correct type, message, and retriability', () => {
    const result = gatewayTimeoutError();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(504);
    expect(result.error.type).toBe('GATEWAY_TIMEOUT');
    expect(result.error.message).toBe(ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.meaning);
    expect(result.error.retriable).toBe(true);
  });

  it('includes details in development when provided', () => {
    process.env.NODE_ENV = 'development';
    const result = gatewayTimeoutError('read timeout after 30s');
    expect(result.error.details).toBe('read timeout after 30s');
  });

  it('omits details in production', () => {
    process.env.NODE_ENV = 'production';
    const result = gatewayTimeoutError('read timeout after 30s');
    expect(result.error.details).toBeUndefined();
  });
});

describe('resolveServerError', () => {
  it('resolves 502 to badGatewayError', () => {
    const result = resolveServerError(502);
    expect(result.error.code).toBe(502);
    expect(result.error.type).toBe('BAD_GATEWAY');
    expect(result.error.retriable).toBe(true);
  });

  it('resolves 503 to serviceUnavailableError with retryAfter 30', () => {
    const result = resolveServerError(503);
    expect(result.error.code).toBe(503);
    expect(result.error.retryAfter).toBe(30);
    expect(result.error.retriable).toBe(true);
  });

  it('resolves 504 to gatewayTimeoutError', () => {
    const result = resolveServerError(504);
    expect(result.error.code).toBe(504);
    expect(result.error.type).toBe('GATEWAY_TIMEOUT');
    expect(result.error.retriable).toBe(true);
  });

  it('resolves unknown codes to internalServerError', () => {
    const result = resolveServerError(500);
    expect(result.error.code).toBe(500);
    expect(result.error.type).toBe('INTERNAL_SERVER_ERROR');
    expect(result.error.retriable).toBe(true);
  });

  it('passes details through to the resolved error in development', () => {
    process.env.NODE_ENV = 'development';
    const result = resolveServerError(502, 'bad upstream');
    expect(result.error.details).toBe('bad upstream');
  });

  it.each([
    [502, 'BAD_GATEWAY', ERROR_CODE_REGISTRY.BAD_GATEWAY.meaning],
    [503, 'SERVICE_UNAVAILABLE', ERROR_CODE_REGISTRY.SERVICE_UNAVAILABLE.meaning],
    [504, 'GATEWAY_TIMEOUT', ERROR_CODE_REGISTRY.GATEWAY_TIMEOUT.meaning],
    [599, 'INTERNAL_SERVER_ERROR', ERROR_CODE_REGISTRY.INTERNAL_ERROR.meaning],
  ])('maps status %i to expected user-facing %s message', (statusCode, errorType, message) => {
    const result = resolveServerError(statusCode);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(statusCode === 599 ? 500 : statusCode);
    expect(result.error.type).toBe(errorType);
    expect(result.error.message).toBe(message);
    expect(result.error.retriable).toBe(true);
  });

  it.each([502, 503, 504, 599])(
    'does not leak sensitive internals in production for status %i',
    (statusCode) => {
      process.env.NODE_ENV = 'production';
      const internalDetails = 'postgres://admin:secret@db.internal stacktrace token=abc123';
      const result = resolveServerError(statusCode, internalDetails);
      const serializedResponse = JSON.stringify(result);

      expect(result.error.details).toBeUndefined();
      expect(serializedResponse).not.toContain('postgres://');
      expect(serializedResponse).not.toContain('secret');
      expect(serializedResponse).not.toContain('stacktrace');
      expect(serializedResponse).not.toContain('abc123');
    },
  );
});

describe('getErrorHeaders', () => {
  it('always includes Content-Type application/json', () => {
    const result = getErrorHeaders(internalServerError());
    expect(result['Content-Type']).toBe('application/json');
  });

  it('includes Retry-After when retryAfter is set', () => {
    const result = getErrorHeaders(rateLimitError(120));
    expect(result['Retry-After']).toBe('120');
  });

  it('omits Retry-After when retryAfter is not set', () => {
    const result = getErrorHeaders(internalServerError());
    expect(result['Retry-After']).toBeUndefined();
  });
});

describe('normalizeApiError', () => {
  it('maps known backend error codes to friendly UI messages', () => {
    const result = normalizeApiError(
      { code: 'NOT_FOUND', message: 'The thing was not found.' },
      404,
    );
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toBe('The requested resource was not found.');
    expect(result.status).toBe(404);
  });

  it('maps network failures to a friendly message', () => {
    const result = normalizeApiError(new TypeError('Failed to fetch'), 0);
    expect(result.code).toBe('NETWORK_ERROR');
    expect(result.message).toBe('We could not reach the server. Please try again.');
  });

  it('maps timeout errors to a friendly message', () => {
    const result = normalizeApiError(new Error('Connection timed out'), 504);
    expect(result.code).toBe('TIMEOUT');
    expect(result.message).toBe('The request took too long. Please try again.');
  });

  it('maps unauthorized errors to a friendly message', () => {
    const result = normalizeApiError(new Error('Unauthorized access'), 401);
    expect(result.code).toBe('UNAUTHORIZED');
    expect(result.message).toBe('You are not authorized to perform that action.');
  });

  it('maps forbidden errors to a friendly message', () => {
    const result = normalizeApiError(new Error('Forbidden action'), 403);
    expect(result.code).toBe('FORBIDDEN');
    expect(result.message).toBe('You do not have permission to do that.');
  });

  it('maps rate limit errors to a friendly message', () => {
    const result = normalizeApiError(new Error('Rate limit exceeded'), 429);
    expect(result.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(result.message).toBe('Too many requests. Please wait before trying again.');
  });

  it('falls back to default message when error has no message', () => {
    const result = normalizeApiError({});
    expect(result.code).toBe('REQUEST_FAILED');
    expect(result.message).toBe('Something went wrong.');
  });

  it('preserves custom error code and message when not in standard mapping', () => {
    const result = normalizeApiError(
      { code: 'CUSTOM_ERROR_CODE', message: 'A specific custom error' },
      418,
    );
    expect(result.code).toBe('CUSTOM_ERROR_CODE');
    expect(result.message).toBe('A specific custom error');
    expect(result.status).toBe(418);
  });
});
