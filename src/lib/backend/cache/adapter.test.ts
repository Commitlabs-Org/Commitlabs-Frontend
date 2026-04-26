import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryAdapter } from './memory';
import { CacheKey, CacheTTL } from './index';

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── get / set ──────────────────────────────────────────────────────────────

  it('returns null for an unknown key', async () => {
    expect(await adapter.get('missing')).toBeNull();
  });

  it('stores and retrieves a value within TTL', async () => {
    await adapter.set('k', { foo: 'bar' }, 60);
    expect(await adapter.get('k')).toEqual({ foo: 'bar' });
  });

  it('returns null after TTL expires', async () => {
    await adapter.set('ttl-key', 'hello', 10); // 10-second TTL

    // Still alive just before expiry.
    vi.advanceTimersByTime(9_999);
    expect(await adapter.get('ttl-key')).toBe('hello');

    // Expired after TTL passes (advance past the boundary, not just to it).
    vi.advanceTimersByTime(2);
    expect(await adapter.get('ttl-key')).toBeNull();
  });

  it('evicts the expired entry from the store on read', async () => {
    await adapter.set('evict-me', 42, 5);
    vi.advanceTimersByTime(5_001);
    await adapter.get('evict-me');
    expect(adapter.size()).toBe(0);
  });

  it('overwrites an existing key with a fresh TTL', async () => {
    await adapter.set('key', 'v1', 10);
    vi.advanceTimersByTime(9_000);
    await adapter.set('key', 'v2', 10); // reset TTL
    vi.advanceTimersByTime(9_000); // total 18s since first write, but only 9s since overwrite
    expect(await adapter.get('key')).toBe('v2');
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  it('delete removes a key', async () => {
    await adapter.set('del-key', true, 60);
    await adapter.delete('del-key');
    expect(await adapter.get('del-key')).toBeNull();
  });

  it('delete is a no-op for a non-existent key', async () => {
    await expect(adapter.delete('ghost')).resolves.not.toThrow();
  });

  // ── invalidate ─────────────────────────────────────────────────────────────

  it('invalidate removes all keys with the given prefix', async () => {
    await adapter.set('ns:a', 1, 60);
    await adapter.set('ns:b', 2, 60);
    await adapter.set('other:c', 3, 60);

    await adapter.invalidate('ns:');

    expect(await adapter.get('ns:a')).toBeNull();
    expect(await adapter.get('ns:b')).toBeNull();
    expect(await adapter.get('other:c')).toBe(3);
  });

  it('invalidate is safe when no keys match the prefix', async () => {
    await adapter.set('x:1', 'a', 60);
    await expect(adapter.invalidate('no-match:')).resolves.not.toThrow();
    expect(await adapter.get('x:1')).toBe('a');
  });

  it('invalidate does not remove non-prefixed keys', async () => {
    await adapter.set('commitlabs:commitment:CMT-1', { id: 'CMT-1' }, 60);
    await adapter.set('commitlabs:user-commitments:GOWNER', [], 60);

    await adapter.invalidate('commitlabs:commitment:');

    expect(await adapter.get('commitlabs:commitment:CMT-1')).toBeNull();
    expect(await adapter.get('commitlabs:user-commitments:GOWNER')).toEqual([]);
  });

  // ── clear ──────────────────────────────────────────────────────────────────

  it('clear removes all entries', async () => {
    await adapter.set('a', 1, 60);
    await adapter.set('b', 2, 60);
    adapter.clear();
    expect(adapter.size()).toBe(0);
  });

  // ── type safety ────────────────────────────────────────────────────────────

  it('preserves complex object structure on round-trip', async () => {
    const value = {
      id: 'CMT-1',
      ownerAddress: 'GOWNER',
      amount: '1000',
      nested: { score: 95 },
    };
    await adapter.set('complex', value, 60);
    expect(await adapter.get('complex')).toEqual(value);
  });

  it('handles array values', async () => {
    const arr = [{ id: '1' }, { id: '2' }];
    await adapter.set('arr', arr, 60);
    expect(await adapter.get('arr')).toEqual(arr);
  });

  // ── TTL boundary ───────────────────────────────────────────────────────────

  it('treats TTL=0 as already expired', async () => {
    await adapter.set('zero-ttl', 'v', 0);
    vi.advanceTimersByTime(1);
    expect(await adapter.get('zero-ttl')).toBeNull();
  });
});

// ── CacheKey builder ───────────────────────────────────────────────────────────

describe('CacheKey', () => {
  it('commitment returns a namespaced key', () => {
    expect(CacheKey.commitment('CMT-001')).toBe('commitlabs:commitment:CMT-001');
  });

  it('userCommitments returns a namespaced key', () => {
    expect(CacheKey.userCommitments('GOWNER')).toBe(
      'commitlabs:user-commitments:GOWNER',
    );
  });

  it('marketplaceListings returns a namespaced key', () => {
    expect(CacheKey.marketplaceListings('{}'))
      .toBe('commitlabs:marketplace:listings:{}');
  });

  it('different ids produce different keys', () => {
    expect(CacheKey.commitment('A')).not.toBe(CacheKey.commitment('B'));
  });
});

// ── CacheTTL values ────────────────────────────────────────────────────────────

describe('CacheTTL', () => {
  it('COMMITMENT_DETAIL is a positive integer in seconds', () => {
    expect(CacheTTL.COMMITMENT_DETAIL).toBeGreaterThan(0);
    expect(Number.isInteger(CacheTTL.COMMITMENT_DETAIL)).toBe(true);
  });

  it('USER_COMMITMENTS is a positive integer in seconds', () => {
    expect(CacheTTL.USER_COMMITMENTS).toBeGreaterThan(0);
  });

  it('MARKETPLACE_LISTINGS is a positive integer in seconds', () => {
    expect(CacheTTL.MARKETPLACE_LISTINGS).toBeGreaterThan(0);
  });
});

// ── factory adapter selection ──────────────────────────────────────────────────

describe('createAdapter (factory)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns MemoryAdapter when CACHE_ADAPTER=memory', async () => {
    vi.stubEnv('CACHE_ADAPTER', 'memory');
    const { cache } = await import('./factory');
    // vi.resetModules() re-loads memory.ts, so use constructor.name to avoid
    // cross-realm instanceof failures between the top-level and re-imported class.
    expect(cache.constructor.name).toBe('MemoryAdapter');
  });

  it('returns MemoryAdapter by default in test environment', async () => {
    vi.stubEnv('CACHE_ADAPTER', '');
    const { cache } = await import('./factory');
    expect(cache.constructor.name).toBe('MemoryAdapter');
  });

  it('throws if CACHE_ADAPTER=redis but REDIS_URL is not set', async () => {
    vi.stubEnv('CACHE_ADAPTER', 'redis');
    vi.stubEnv('REDIS_URL', '');
    await expect(import('./factory')).rejects.toThrow(/REDIS_URL/);
  });
});
