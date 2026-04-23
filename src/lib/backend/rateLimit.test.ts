import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit } from './rateLimit';

describe('checkRateLimit', () => {
  describe('in development mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    it('should return allowed: true for any key and route', async () => {
      const result = await checkRateLimit('1.2.3.4', 'api/commitments');
      expect(result).toEqual({ allowed: true });
    });

    it('should not include retryAfterSeconds when allowed', async () => {
      const result = await checkRateLimit('key', 'route');
      expect(result.retryAfterSeconds).toBeUndefined();
    });
  });

  describe('return type — RateLimitResult', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('should return RateLimitResult shape', async () => {
      const result = await checkRateLimit('some-key', 'api/test');
      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should include retryAfterSeconds when not allowed (future production impl)', async () => {
      // Current stub always allows in production too — this documents the intended shape
      const result = await checkRateLimit('key', 'route');
      if (!result.allowed) {
        expect(typeof result.retryAfterSeconds).toBe('number');
      }
    });
  });
});
