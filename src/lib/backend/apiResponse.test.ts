import { describe, it, expect } from 'vitest';
import { ok, fail } from './apiResponse';

describe('ok()', () => {
  it('should return 200 with data', async () => {
    const res = ok({ id: 1 });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { id: 1 } });
  });

  it('should return custom status when meta is a number', async () => {
    const res = ok({ id: 1 }, 201);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ success: true, data: { id: 1 } });
  });

  it('should include meta when provided as object', async () => {
    const res = ok([1, 2, 3], { total: 3, page: 1 });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      success: true,
      data: [1, 2, 3],
      meta: { total: 3, page: 1 },
    });
  });
});

describe('fail()', () => {
  it('should return error body without retryAfterSeconds when not provided', async () => {
    const res = fail('NOT_FOUND', 'Commitment not found.', undefined, 404);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Commitment not found.',
      },
    });
  });

  it('should not include Retry-After header when retryAfterSeconds is undefined', async () => {
    const res = fail('NOT_FOUND', 'Not found.', undefined, 404);
    expect(res.headers.get('Retry-After')).toBeNull();
  });

  it('should include retryAfterSeconds in body when provided', async () => {
    const res = fail('TOO_MANY_REQUESTS', 'Rate limited.', undefined, 429, 60);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error.retryAfterSeconds).toBe(60);
  });

  it('should include Retry-After header when retryAfterSeconds is provided', async () => {
    const res = fail('TOO_MANY_REQUESTS', 'Rate limited.', undefined, 429, 60);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('should use 0 as Retry-After header value when retryAfterSeconds is 0', async () => {
    const res = fail('TOO_MANY_REQUESTS', 'Rate limited.', undefined, 429, 0);
    expect(res.headers.get('Retry-After')).toBe('0');
    const json = await res.json();
    expect(json.error.retryAfterSeconds).toBe(0);
  });

  it('should include details when provided', async () => {
    const res = fail('VALIDATION_ERROR', 'Invalid input.', { field: 'amount' }, 400);
    const json = await res.json();

    expect(json.error.details).toEqual({ field: 'amount' });
  });

  it('should omit details when undefined', async () => {
    const res = fail('INTERNAL_ERROR', 'Something went wrong.', undefined, 500);
    const json = await res.json();

    expect(json.error.details).toBeUndefined();
  });

  it('should include both details and retryAfterSeconds', async () => {
    const res = fail('TOO_MANY_REQUESTS', 'Rate limited.', { ip: '1.2.3.4' }, 429, 45);
    const json = await res.json();

    expect(json).toEqual({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limited.',
        details: { ip: '1.2.3.4' },
        retryAfterSeconds: 45,
      },
    });
  });

  it('should use 503 with ServiceUnavailableError retryAfterSeconds', async () => {
    const res = fail('SERVICE_UNAVAILABLE', 'Down for maintenance.', undefined, 503, 30);
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    const json = await res.json();
    expect(json.error.retryAfterSeconds).toBe(30);
  });
});
