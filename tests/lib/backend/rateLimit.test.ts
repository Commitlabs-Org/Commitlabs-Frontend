import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';

// ── mock KV store ─────────────────────────────────────────────────────────────
// Use a plain mock object — avoids the vi.mock hoisting / importActual issue
// that arises when instantiating class constructors inside a factory.

const mockKv = {
  incr: vi.fn(),
  expire: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  getdel: vi.fn(),
};

vi.mock('@/lib/backend/kv', () => ({
  getKV: () => mockKv,
}));

const TEST_ROUTE = 'api/commitments/create';
const TEST_KEY = 'test-user';

beforeEach(() => {
  vi.clearAllMocks();
  mockKv.expire.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('rateLimit', () => {
  it('increments count and allows up to limit', async () => {
    const max = 10; // default write max
    for (let i = 1; i <= max; i++) {
      mockKv.incr.mockResolvedValueOnce(i);
      const allowed = await checkRateLimit(TEST_KEY, TEST_ROUTE);
      expect(allowed).toBe(true);
    }
    // next request should be blocked
    mockKv.incr.mockResolvedValueOnce(max + 1);
    const blocked = await checkRateLimit(TEST_KEY, TEST_ROUTE);
    expect(blocked).toBe(false);
  });

  it('sets TTL on the first request (count === 1)', async () => {
    mockKv.incr.mockResolvedValue(1);
    await checkRateLimit(TEST_KEY, TEST_ROUTE);
    expect(mockKv.expire).toHaveBeenCalledWith(
      `ratelimit:${TEST_ROUTE}:${TEST_KEY}`,
      60,
    );
  });

  it('does not reset TTL on subsequent requests', async () => {
    mockKv.incr.mockResolvedValue(5);
    await checkRateLimit(TEST_KEY, TEST_ROUTE);
    expect(mockKv.expire).not.toHaveBeenCalled();
  });

  it('honors env overrides for write routes', async () => {
    const originalMax = process.env.RATE_LIMIT_WRITE_MAX_REQUESTS;
    process.env.RATE_LIMIT_WRITE_MAX_REQUESTS = '2';

    mockKv.incr.mockResolvedValueOnce(1);
    expect(await checkRateLimit(TEST_KEY, TEST_ROUTE)).toBe(true);
    mockKv.incr.mockResolvedValueOnce(2);
    expect(await checkRateLimit(TEST_KEY, TEST_ROUTE)).toBe(true);
    mockKv.incr.mockResolvedValueOnce(3);
    expect(await checkRateLimit(TEST_KEY, TEST_ROUTE)).toBe(false);

    process.env.RATE_LIMIT_WRITE_MAX_REQUESTS = originalMax ?? '';
  });

  it('falls back to default on invalid env values', async () => {
    const originalMax = process.env.RATE_LIMIT_WRITE_MAX_REQUESTS;
    process.env.RATE_LIMIT_WRITE_MAX_REQUESTS = '-5';

    // default is 10 — count of 10 should be allowed
    mockKv.incr.mockResolvedValueOnce(10);
    expect(await checkRateLimit('another-user', TEST_ROUTE)).toBe(true);

    process.env.RATE_LIMIT_WRITE_MAX_REQUESTS = originalMax ?? '';
  });

  it('fails open (allows request) when KV throws', async () => {
    mockKv.incr.mockRejectedValue(new Error('Redis connection failed'));
    const allowed = await checkRateLimit(TEST_KEY, TEST_ROUTE);
    expect(allowed).toBe(true);
  });
});

describe('auth-route env overrides', () => {
  // Restore env vars after each test so they don't bleed into other suites.
  afterEach(() => {
    [
      'RATE_LIMIT_AUTH_NONCE_MAX_REQUESTS',
      'RATE_LIMIT_AUTH_NONCE_WINDOW_SECONDS',
      'RATE_LIMIT_AUTH_VERIFY_MAX_REQUESTS',
      'RATE_LIMIT_AUTH_VERIFY_WINDOW_SECONDS',
      'RATE_LIMIT_NONCE_ADDRESS_MAX_REQUESTS',
      'RATE_LIMIT_NONCE_ADDRESS_WINDOW_SECONDS',
    ].forEach((k) => delete process.env[k]);
  });

  // ── api/auth/nonce ────────────────────────────────────────────────────────

  it('api/auth/nonce: respects RATE_LIMIT_AUTH_NONCE_MAX_REQUESTS', async () => {
    process.env.RATE_LIMIT_AUTH_NONCE_MAX_REQUESTS = '2';
    const key = 'nonce-ip-1';

    mockKv.incr.mockResolvedValueOnce(1);
    expect(await checkRateLimit(key, 'api/auth/nonce')).toBe(true);
    mockKv.incr.mockResolvedValueOnce(2);
    expect(await checkRateLimit(key, 'api/auth/nonce')).toBe(true);
    mockKv.incr.mockResolvedValueOnce(3);
    expect(await checkRateLimit(key, 'api/auth/nonce')).toBe(false);
  });

  it('api/auth/nonce: getRateLimitWindowSeconds respects RATE_LIMIT_AUTH_NONCE_WINDOW_SECONDS', () => {
    process.env.RATE_LIMIT_AUTH_NONCE_WINDOW_SECONDS = '30';
    expect(getRateLimitWindowSeconds('api/auth/nonce')).toBe(30);
  });

  it('api/auth/nonce: falls back to default max (5) on invalid env value', async () => {
    process.env.RATE_LIMIT_AUTH_NONCE_MAX_REQUESTS = 'bad';
    const key = 'nonce-ip-fallback';

    // count of 5 should be allowed, 6 blocked
    mockKv.incr.mockResolvedValueOnce(5);
    expect(await checkRateLimit(key, 'api/auth/nonce')).toBe(true);
    mockKv.incr.mockResolvedValueOnce(6);
    expect(await checkRateLimit(key, 'api/auth/nonce')).toBe(false);
  });

  it('api/auth/nonce: falls back to default window (60 s) on invalid env value', () => {
    process.env.RATE_LIMIT_AUTH_NONCE_WINDOW_SECONDS = '-99';
    expect(getRateLimitWindowSeconds('api/auth/nonce')).toBe(60);
  });

  // ── api/auth/verify ───────────────────────────────────────────────────────

  it('api/auth/verify: respects RATE_LIMIT_AUTH_VERIFY_MAX_REQUESTS', async () => {
    process.env.RATE_LIMIT_AUTH_VERIFY_MAX_REQUESTS = '2';
    const key = 'verify-ip-1';

    mockKv.incr.mockResolvedValueOnce(1);
    expect(await checkRateLimit(key, 'api/auth/verify')).toBe(true);
    mockKv.incr.mockResolvedValueOnce(2);
    expect(await checkRateLimit(key, 'api/auth/verify')).toBe(true);
    mockKv.incr.mockResolvedValueOnce(3);
    expect(await checkRateLimit(key, 'api/auth/verify')).toBe(false);
  });

  it('api/auth/verify: getRateLimitWindowSeconds respects RATE_LIMIT_AUTH_VERIFY_WINDOW_SECONDS', () => {
    process.env.RATE_LIMIT_AUTH_VERIFY_WINDOW_SECONDS = '45';
    expect(getRateLimitWindowSeconds('api/auth/verify')).toBe(45);
  });

  it('api/auth/verify: falls back to default max (5) on invalid env value', async () => {
    process.env.RATE_LIMIT_AUTH_VERIFY_MAX_REQUESTS = '0';
    const key = 'verify-ip-fallback';

    mockKv.incr.mockResolvedValueOnce(5);
    expect(await checkRateLimit(key, 'api/auth/verify')).toBe(true);
    mockKv.incr.mockResolvedValueOnce(6);
    expect(await checkRateLimit(key, 'api/auth/verify')).toBe(false);
  });

  it('api/auth/verify: falls back to default window (60 s) on invalid env value', () => {
    process.env.RATE_LIMIT_AUTH_VERIFY_WINDOW_SECONDS = 'nan';
    expect(getRateLimitWindowSeconds('api/auth/verify')).toBe(60);
  });

  // ── auth:nonce:address ────────────────────────────────────────────────────

  it('auth:nonce:address: respects RATE_LIMIT_NONCE_ADDRESS_MAX_REQUESTS', async () => {
    process.env.RATE_LIMIT_NONCE_ADDRESS_MAX_REQUESTS = '2';
    const key = 'addr-GTEST';

    mockKv.incr.mockResolvedValueOnce(1);
    expect(await checkRateLimit(key, 'auth:nonce:address')).toBe(true);
    mockKv.incr.mockResolvedValueOnce(2);
    expect(await checkRateLimit(key, 'auth:nonce:address')).toBe(true);
    mockKv.incr.mockResolvedValueOnce(3);
    expect(await checkRateLimit(key, 'auth:nonce:address')).toBe(false);
  });

  it('auth:nonce:address: getRateLimitWindowSeconds respects RATE_LIMIT_NONCE_ADDRESS_WINDOW_SECONDS', () => {
    process.env.RATE_LIMIT_NONCE_ADDRESS_WINDOW_SECONDS = '120';
    expect(getRateLimitWindowSeconds('auth:nonce:address')).toBe(120);
  });

  it('auth:nonce:address: falls back to default max (3) on invalid env value', async () => {
    process.env.RATE_LIMIT_NONCE_ADDRESS_MAX_REQUESTS = '-1';
    const key = 'addr-fallback';

    mockKv.incr.mockResolvedValueOnce(3);
    expect(await checkRateLimit(key, 'auth:nonce:address')).toBe(true);
    mockKv.incr.mockResolvedValueOnce(4);
    expect(await checkRateLimit(key, 'auth:nonce:address')).toBe(false);
  });

  it('auth:nonce:address: falls back to default window (300 s) on invalid env value', () => {
    process.env.RATE_LIMIT_NONCE_ADDRESS_WINDOW_SECONDS = 'abc';
    expect(getRateLimitWindowSeconds('auth:nonce:address')).toBe(300);
  });
});
