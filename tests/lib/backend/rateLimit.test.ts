import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/src/lib/backend/rateLimit';
import { getKV, KVStore } from '@/src/lib/backend/kv';

// Mock getKV to return a fresh in‑memory store for each test suite
vi.mock('@/src/lib/backend/kv', async () => {
  const actual = await vi.importActual('@/src/lib/backend/kv');
  const { MemoryKVStore } = actual;
  const kvInstance = new MemoryKVStore();
  return {
    getKV: () => kvInstance,
    KVStore: actual.KVStore,
  };
});

const TEST_ROUTE = 'api/commitments/create';
const TEST_KEY = 'test-user';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.runOnlyPendingTimers();
});

describe('rateLimit', () => {
  it('increments count and allows up to limit', async () => {
    const max = Number(process.env.RATE_LIMIT_WRITE_MAX_REQUESTS ?? 10);
    for (let i = 1; i <= max; i++) {
      const allowed = await checkRateLimit(TEST_KEY, TEST_ROUTE);
      expect(allowed).toBe(true);
    }
    // next request should be blocked
    const blocked = await checkRateLimit(TEST_KEY, TEST_ROUTE);
    expect(blocked).toBe(false);
  });

  it('resets counter after window expiry', async () => {
    // first request increments and sets expiry
    await checkRateLimit(TEST_KEY, TEST_ROUTE);
    // fast‑forward past the window
    const windowSec = getRateLimitWindowSeconds(TEST_ROUTE);
    vi.advanceTimersByTime(windowSec * 1000 + 1);
    // counter should be reset, allowing a new request
    const allowed = await checkRateLimit(TEST_KEY, TEST_ROUTE);
    expect(allowed).toBe(true);
  });

  it('honors env overrides and falls back on invalid values', async () => {
    // set valid overrides
    process.env.RATE_LIMIT_WRITE_MAX_REQUESTS = '2';
    process.env.RATE_LIMIT_WRITE_WINDOW_SECONDS = '1';
    const allowed1 = await checkRateLimit(TEST_KEY, TEST_ROUTE);
    const allowed2 = await checkRateLimit(TEST_KEY, TEST_ROUTE);
    expect(allowed1).toBe(true);
    expect(allowed2).toBe(true);
    const blocked = await checkRateLimit(TEST_KEY, TEST_ROUTE);
    expect(blocked).toBe(false);

    // invalid overrides should fallback to defaults (10 requests, 60s window)
    process.env.RATE_LIMIT_WRITE_MAX_REQUESTS = '-5';
    process.env.RATE_LIMIT_WRITE_WINDOW_SECONDS = 'abc';
    const newKey = 'another-user';
    const allowedDefault = await checkRateLimit(newKey, TEST_ROUTE);
    expect(allowedDefault).toBe(true);
  });
});
