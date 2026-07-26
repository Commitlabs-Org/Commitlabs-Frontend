import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KeyValueStorageAdapter,
  MemoryStorageAdapter,
  createStorageAdapter,
} from './storage';

describe('MemoryStorageAdapter', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = new MemoryStorageAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('supports get, set, and delete', async () => {
    await storage.set('example', { ok: true });

    expect(await storage.get<{ ok: boolean }>('example')).toEqual({ ok: true });

    await storage.delete('example');

    expect(await storage.get('example')).toBeNull();
  });

  it('expires values after their TTL', async () => {
    await storage.set('ttl:key', 'value', { ttlMs: 1000 });

    vi.advanceTimersByTime(999);
    expect(await storage.get('ttl:key')).toBe('value');

    vi.advanceTimersByTime(2);
    expect(await storage.get('ttl:key')).toBeNull();
  });

  it('increments counters and preserves the original TTL window', async () => {
    expect(await storage.increment('counter:key', { ttlMs: 1000 })).toBe(1);
    expect(await storage.increment('counter:key')).toBe(2);

    vi.advanceTimersByTime(1001);

    expect(await storage.get('counter:key')).toBeNull();
    expect(await storage.increment('counter:key')).toBe(1);
  });
});

describe('KeyValueStorageAdapter', () => {
  it('serializes values through an injected key-value client', async () => {
    const client = {
      get: vi.fn().mockResolvedValue(JSON.stringify({ count: 3 })),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      increment: vi.fn().mockResolvedValue(4),
      expire: vi.fn().mockResolvedValue(undefined),
    };

    const storage = new KeyValueStorageAdapter(client);

    await storage.set('session:key', { count: 3 }, { ttlMs: 1500 });
    expect(client.set).toHaveBeenCalledWith(
      'session:key',
      JSON.stringify({ count: 3 }),
      { ttlSeconds: 2 },
    );

    expect(await storage.get<{ count: number }>('session:key')).toEqual({
      count: 3,
    });

    expect(await storage.increment('session:key', { ttlMs: 2000 })).toBe(4);
    expect(client.expire).toHaveBeenCalledWith('session:key', 2);

    await storage.delete('session:key');
    expect(client.delete).toHaveBeenCalledWith('session:key');
  });

  it('returns a safe error when the external client is unavailable', async () => {
    const client = {
      get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED redis://secret')),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      increment: vi.fn().mockResolvedValue(1),
    };

    const storage = new KeyValueStorageAdapter(client);

    await expect(storage.get('nonce:key')).rejects.toThrow(
      'Storage operation failed',
    );
  });
});

describe('createStorageAdapter', () => {
  it('falls back to memory storage when an external provider is requested without a client', () => {
    const storage = createStorageAdapter({ provider: 'redis' });

    expect(storage).toBeInstanceOf(MemoryStorageAdapter);
  });
});
