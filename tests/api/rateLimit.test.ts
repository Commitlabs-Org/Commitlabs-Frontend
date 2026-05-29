/**
 * Unit tests for src/lib/backend/rateLimit.ts
 *
 * Covers:
 *   - checkRateLimit allows requests under the limit
 *   - checkRateLimit blocks requests over the limit
 *   - Named write-route entries are applied (not the default)
 *   - getRateLimitWindowSeconds returns the correct window
 *   - Env-var overrides are respected
 *   - KV errors fail open (allow the request)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── mock KV store ─────────────────────────────────────────────────────────────

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

// Re-import after mocking so the module picks up the mock
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';

describe('getRateLimitWindowSeconds', () => {
  it('returns 60 for write routes by default', () => {
    expect(getRateLimitWindowSeconds('api/commitments/create')).toBe(60);
    expect(getRateLimitWindowSeconds('api/commitments/settle')).toBe(60);
    expect(getRateLimitWindowSeconds('api/commitments/early-exit')).toBe(60);
  });

  it('returns 60 for unknown routes (default)', () => {
    expect(getRateLimitWindowSeconds('api/unknown/route')).toBe(60);
  });

  it('respects RATE_LIMIT_WRITE_WINDOW_SECONDS env var', () => {
    const original = process.env.RATE_LIMIT_WRITE_WINDOW_SECONDS;
    process.env.RATE_LIMIT_WRITE_WINDOW_SECONDS = '120';
    expect(getRateLimitWindowSeconds('api/commitments/settle')).toBe(120);
    process.env.RATE_LIMIT_WRITE_WINDOW_SECONDS = original ?? '';
  });

  it('respects RATE_LIMIT_DEFAULT_WINDOW_SECONDS env var', () => {
    const original = process.env.RATE_LIMIT_DEFAULT_WINDOW_SECONDS;
    process.env.RATE_LIMIT_DEFAULT_WINDOW_SECONDS = '30';
    expect(getRateLimitWindowSeconds('api/unknown')).toBe(30);
    process.env.RATE_LIMIT_DEFAULT_WINDOW_SECONDS = original ?? '';
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKv.expire.mockResolvedValue(undefined);
  });

  it('allows request when count is within limit', async () => {
    mockKv.incr.mockResolvedValue(1);
    const allowed = await checkRateLimit('1.2.3.4', 'api/commitments/create');
    expect(allowed).toBe(true);
  });

  it('allows request at exactly the limit', async () => {
    // Default write limit is 10
    mockKv.incr.mockResolvedValue(10);
    const allowed = await checkRateLimit('1.2.3.4', 'api/commitments/create');
    expect(allowed).toBe(true);
  });

  it('blocks request when count exceeds the limit', async () => {
    mockKv.incr.mockResolvedValue(11);
    const allowed = await checkRateLimit('1.2.3.4', 'api/commitments/create');
    expect(allowed).toBe(false);
  });

  it('blocks settle requests when count exceeds the write limit', async () => {
    mockKv.incr.mockResolvedValue(11);
    const allowed = await checkRateLimit('1.2.3.4', 'api/commitments/settle');
    expect(allowed).toBe(false);
  });

  it('blocks early-exit requests when count exceeds the write limit', async () => {
    mockKv.incr.mockResolvedValue(11);
    const allowed = await checkRateLimit('1.2.3.4', 'api/commitments/early-exit');
    expect(allowed).toBe(false);
  });

  it('sets TTL on the first request (count === 1)', async () => {
    mockKv.incr.mockResolvedValue(1);
    await checkRateLimit('1.2.3.4', 'api/commitments/settle');
    expect(mockKv.expire).toHaveBeenCalledWith(
      'ratelimit:api/commitments/settle:1.2.3.4',
      60,
    );
  });

  it('does not reset TTL on subsequent requests', async () => {
    mockKv.incr.mockResolvedValue(5);
    await checkRateLimit('1.2.3.4', 'api/commitments/settle');
    expect(mockKv.expire).not.toHaveBeenCalled();
  });

  it('uses the correct KV key format', async () => {
    mockKv.incr.mockResolvedValue(1);
    await checkRateLimit('5.6.7.8', 'api/commitments/early-exit');
    expect(mockKv.incr).toHaveBeenCalledWith(
      'ratelimit:api/commitments/early-exit:5.6.7.8',
    );
  });

  it('fails open (allows request) when KV throws', async () => {
    mockKv.incr.mockRejectedValue(new Error('Redis connection failed'));
    const allowed = await checkRateLimit('1.2.3.4', 'api/commitments/create');
    expect(allowed).toBe(true);
  });

  it('respects RATE_LIMIT_WRITE_MAX_REQUESTS env var', async () => {
    const original = process.env.RATE_LIMIT_WRITE_MAX_REQUESTS;
    process.env.RATE_LIMIT_WRITE_MAX_REQUESTS = '5';

    mockKv.incr.mockResolvedValue(6);
    const allowed = await checkRateLimit('1.2.3.4', 'api/commitments/create');
    expect(allowed).toBe(false);

    process.env.RATE_LIMIT_WRITE_MAX_REQUESTS = original ?? '';
  });

  it('uses default limit for unknown routes', async () => {
    // Default is 20 — count of 20 should be allowed, 21 blocked
    mockKv.incr.mockResolvedValue(20);
    expect(await checkRateLimit('1.2.3.4', 'api/some/other/route')).toBe(true);

    mockKv.incr.mockResolvedValue(21);
    expect(await checkRateLimit('1.2.3.4', 'api/some/other/route')).toBe(false);
  });
});
