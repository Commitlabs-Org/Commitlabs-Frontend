import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KVStore } from '../kv';

async function createMemoryKV(): Promise<KVStore> {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

  const { getKV } = await import('../kv');

  return getKV();
}

describe('backend kv adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns null for missing keys', async () => {
    const kv = await createMemoryKV();

    await expect(kv.get('missing-key')).resolves.toBeNull();
  });

  it('sets and retrieves JSON-compatible values', async () => {
    const kv = await createMemoryKV();
    const value = {
      id: 'commitment-1',
      owner: 'GABC',
      attempts: 2,
      flags: ['rate-limit', 'nonce'],
    };

    await kv.set('commitment:1', value);

    await expect(kv.get('commitment:1')).resolves.toEqual(value);
  });

  it('overwrites an existing key with the latest value', async () => {
    const kv = await createMemoryKV();

    await kv.set('nonce:123', { status: 'created' });
    await kv.set('nonce:123', { status: 'consumed' });

    await expect(kv.get('nonce:123')).resolves.toEqual({ status: 'consumed' });
  });

  it('deletes existing keys and treats missing-key deletes as no-ops', async () => {
    const kv = await createMemoryKV();

    await kv.set('cache:item', 'cached');
    await kv.del('cache:item');

    await expect(kv.get('cache:item')).resolves.toBeNull();
    await expect(kv.del('cache:item')).resolves.toBeUndefined();
  });

  it('expires keys after their ttl elapses', async () => {
    const kv = await createMemoryKV();

    await kv.set('ttl:item', 'still-valid', 1);

    vi.advanceTimersByTime(999);
    await expect(kv.get('ttl:item')).resolves.toBe('still-valid');

    vi.advanceTimersByTime(2);
    await expect(kv.get('ttl:item')).resolves.toBeNull();
  });

  it('applies expire to an existing key without changing its value', async () => {
    const kv = await createMemoryKV();

    await kv.set('session:item', { active: true });
    await kv.expire('session:item', 2);

    vi.advanceTimersByTime(1_999);
    await expect(kv.get('session:item')).resolves.toEqual({ active: true });

    vi.advanceTimersByTime(2);
    await expect(kv.get('session:item')).resolves.toBeNull();
  });

  it('getdel returns the value once and removes the key', async () => {
    const kv = await createMemoryKV();

    await kv.set('nonce:single-use', 'abc123');

    await expect(kv.getdel('nonce:single-use')).resolves.toBe('abc123');
    await expect(kv.get('nonce:single-use')).resolves.toBeNull();
  });
});
