import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { withApiHandler } from './withApiHandler';
import { ok } from './apiResponse';
import {
  TooManyRequestsError,
  ServiceUnavailableError,
  BadRequestError,
  ValidationError,
} from './errors';

function mockRequest(url = 'http://localhost/api/test', method = 'GET') {
  return new NextRequest(url, { method });
}

describe('withApiHandler — success', () => {
  it('should return the handler result as-is', async () => {
    const handler = withApiHandler(async () => {
      return ok({ value: 42 });
    });

    const res = await handler(mockRequest(), { params: {} });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { value: 42 } });
  });
});

describe('withApiHandler — ApiError propagation', () => {
  it('should return 429 with Retry-After from TooManyRequestsError', async () => {
    const handler = withApiHandler(async () => {
      throw new TooManyRequestsError('Too many requests.', { ip: '1.2.3.4' }, 60);
    });

    const res = await handler(mockRequest(), { params: {} });
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json).toEqual({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests.',
        details: { ip: '1.2.3.4' },
        retryAfterSeconds: 60,
      },
    });
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('should return 429 with default retryAfterSeconds from TooManyRequestsError', async () => {
    const handler = withApiHandler(async () => {
      throw new TooManyRequestsError();
    });

    const res = await handler(mockRequest(), { params: {} });
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error.retryAfterSeconds).toBe(60);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('should return 503 with Retry-After from ServiceUnavailableError', async () => {
    const handler = withApiHandler(async () => {
      throw new ServiceUnavailableError('Maintenance.', undefined, 45);
    });

    const res = await handler(mockRequest(), { params: {} });
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json).toEqual({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Maintenance.',
        retryAfterSeconds: 45,
      },
    });
    expect(res.headers.get('Retry-After')).toBe('45');
  });

  it('should return 400 for BadRequestError without Retry-After', async () => {
    const handler = withApiHandler(async () => {
      throw new BadRequestError('Invalid param.');
    });

    const res = await handler(mockRequest(), { params: {} });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('BAD_REQUEST');
    expect(json.error.retryAfterSeconds).toBeUndefined();
    expect(res.headers.get('Retry-After')).toBeNull();
  });

  it('should return 400 for ValidationError without Retry-After', async () => {
    const handler = withApiHandler(async () => {
      throw new ValidationError('Schema mismatch.');
    });

    const res = await handler(mockRequest(), { params: {} });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.retryAfterSeconds).toBeUndefined();
    expect(res.headers.get('Retry-After')).toBeNull();
  });

  it('should propagate err.details when present on ApiError', async () => {
    const handler = withApiHandler(async () => {
      throw new TooManyRequestsError('msg', { key: 'value' });
    });

    const res = await handler(mockRequest(), { params: {} });
    const json = await res.json();

    expect(json.error.details).toEqual({ key: 'value' });
  });
});

describe('withApiHandler — non-ApiError', () => {
  it('should return 500 with INTERNAL_ERROR for plain Error', async () => {
    const handler = withApiHandler(async () => {
      throw new Error('Unexpected crash');
    });

    const res = await handler(mockRequest(), { params: {} });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe('INTERNAL_ERROR');
    expect(json.error.message).toBe('An unexpected error occurred. Please try again later.');
    expect(json.error.retryAfterSeconds).toBeUndefined();
    expect(res.headers.get('Retry-After')).toBeNull();
  });

  it('should return 500 for string thrown as error', async () => {
    const handler = withApiHandler(async () => {
      throw 'some string error';
    });

    const res = await handler(mockRequest(), { params: {} });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe('INTERNAL_ERROR');
  });

  it('should return 500 for null thrown as error', async () => {
    const handler = withApiHandler(async () => {
      throw null;
    });

    const res = await handler(mockRequest(), { params: {} });
    await res.json();

    expect(res.status).toBe(500);
  });
});

describe('withApiHandler — pass-through context.params', () => {
  it('should pass context.params to handler', async () => {
    const handler = withApiHandler(async (_req, context) => {
      return ok({ id: context.params.id });
    });

    const res = await handler(mockRequest(), { params: { id: 'abc-123' } });
    const json = await res.json();

    expect(json.data).toEqual({ id: 'abc-123' });
  });
});
