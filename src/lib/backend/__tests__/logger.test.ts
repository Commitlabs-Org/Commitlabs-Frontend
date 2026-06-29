import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  logInfo,
  logWarn,
  logError,
  logDebug,
  getRequestId,
} from '../logger';

/**
 * Parses the single argument the logger passes to a console spy back into the
 * structured log record it emitted.
 */
function emitted(spy: ReturnType<typeof vi.spyOn>) {
  expect(spy).toHaveBeenCalledTimes(1);
  return JSON.parse(spy.mock.calls[0][0] as string);
}

describe('backend logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('structured records per level', () => {
    it('logInfo emits an info record with the expected shape', () => {
      logInfo(undefined, 'hello');
      const record = emitted(logSpy);
      expect(record.level).toBe('info');
      expect(record.message).toBe('hello');
      expect(typeof record.timestamp).toBe('string');
      expect(Number.isNaN(Date.parse(record.timestamp))).toBe(false);
    });

    it('logWarn emits a warn record on console.warn', () => {
      logWarn(undefined, 'careful');
      expect(emitted(warnSpy).level).toBe('warn');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('logError emits an error record on console.error', () => {
      logError(undefined, 'boom');
      expect(emitted(errorSpy).level).toBe('error');
    });
  });

  describe('request-context fields', () => {
    it('attaches a string request id when provided directly', () => {
      logInfo('req-123', 'with id');
      expect(emitted(logSpy).requestId).toBe('req-123');
    });

    it('derives the request id from an x-request-id header', () => {
      const req = new Request('https://example.test', {
        headers: { 'x-request-id': 'header-req-9' },
      });
      logInfo(req, 'from header');
      expect(emitted(logSpy).requestId).toBe('header-req-9');
      // getRequestId is stable for the same header value.
      expect(getRequestId(req)).toBe('header-req-9');
    });

    it('includes a context object when present and omits it otherwise', () => {
      logInfo('r1', 'ctx', { route: '/api/x', count: 2 });
      const withCtx = emitted(logSpy);
      expect(withCtx.context).toEqual({ route: '/api/x', count: 2 });

      logSpy.mockClear();
      logInfo('r1', 'no ctx');
      expect(emitted(logSpy).context).toBeUndefined();
    });
  });

  describe('redaction', () => {
    it('redacts sensitive context fields before emission', () => {
      logInfo('r1', 'login', { token: 'super-secret', userId: 'u1' });
      const record = emitted(logSpy);
      expect(record.context.token).toBe('[REDACTED]');
      // Non-sensitive fields pass through untouched.
      expect(record.context.userId).toBe('u1');
    });

    it('serializes and redacts an error object on logError', () => {
      const err = new Error('failure with password=abc');
      err.name = 'CustomError';
      logError('r1', 'failed', err, { password: 'hunter2' });
      const record = emitted(errorSpy);
      expect(record.error.name).toBe('CustomError');
      expect(typeof record.error.message).toBe('string');
      expect(record.context.password).toBe('[REDACTED]');
    });
  });

  describe('level filtering', () => {
    const original = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = original;
    });

    it('suppresses debug logs outside development', () => {
      process.env.NODE_ENV = 'production';
      logDebug('r1', 'noisy');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('emits debug logs in development', () => {
      process.env.NODE_ENV = 'development';
      logDebug('r1', 'noisy');
      expect(emitted(debugSpy).level).toBe('debug');
    });
  });
});
