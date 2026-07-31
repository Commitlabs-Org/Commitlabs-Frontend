import { describe, it, expect, afterEach, vi } from 'vitest';

// PersistentCounters imports ioredis at module load time. Mock it so the test
// suite never needs a real Redis connection.
vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(() => ({
    incr: vi.fn(),
    mget: vi.fn().mockResolvedValue([null, null, null, null]),
    del: vi.fn(),
    quit: vi.fn(),
  }));
  return { default: RedisMock };
});

describe('getCountersAdapter (provider)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns InMemoryCounters in development environment', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { getCountersAdapter } = await import('./provider');
    expect(getCountersAdapter().constructor.name).toBe('InMemoryCounters');
  });

  it('returns InMemoryCounters in test environment', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { getCountersAdapter } = await import('./provider');
    expect(getCountersAdapter().constructor.name).toBe('InMemoryCounters');
  });

  it('returns PersistentCounters in production environment', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getCountersAdapter } = await import('./provider');
    expect(getCountersAdapter().constructor.name).toBe('PersistentCounters');
  });

  it('returns the same instance on repeated calls (singleton)', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { getCountersAdapter } = await import('./provider');
    const first = getCountersAdapter();
    const second = getCountersAdapter();
    expect(first).toBe(second);
  });

  it('setCountersAdapter overrides the instance returned by getCountersAdapter', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { getCountersAdapter, setCountersAdapter } = await import('./provider');

    const mock = {
      incrementRateLimitBlocks: vi.fn(),
      incrementAuthFailures: vi.fn(),
      incrementChainFailures: vi.fn(),
      incrementSuccessfulActions: vi.fn(),
      getMetrics: vi.fn(),
      reset: vi.fn(),
    };

    setCountersAdapter(mock);
    expect(getCountersAdapter()).toBe(mock);
  });

  it('resetCountersAdapter calls reset() on the current instance and clears the singleton', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { getCountersAdapter, setCountersAdapter, resetCountersAdapter } =
      await import('./provider');

    const mock = {
      incrementRateLimitBlocks: vi.fn(),
      incrementAuthFailures: vi.fn(),
      incrementChainFailures: vi.fn(),
      incrementSuccessfulActions: vi.fn(),
      getMetrics: vi.fn(),
      reset: vi.fn(),
    };

    setCountersAdapter(mock);
    await resetCountersAdapter();

    // reset() should have been called on the mock
    expect(mock.reset).toHaveBeenCalledOnce();

    // After reset the singleton is cleared, so the next call creates a fresh instance
    const fresh = getCountersAdapter();
    expect(fresh).not.toBe(mock);
    expect(fresh.constructor.name).toBe('InMemoryCounters');
  });

  it('resetCountersAdapter is a no-op when no instance is set', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { resetCountersAdapter } = await import('./provider');
    // Should not throw even when called before any adapter has been created
    await expect(resetCountersAdapter()).resolves.toBeUndefined();
  });
});
