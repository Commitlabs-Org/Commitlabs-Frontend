/**
 * Unit tests for InMemoryKVStore and IdempotencyService.
 *
 * These tests verify the low-level contract of the idempotency system that
 * the fund route (and other mutation routes) depend on for at-most-once
 * delivery semantics:
 *
 *   1. A key that is STARTed can be COMPLETEd with a response payload.
 *   2. A key that FAILs is deleted so callers can retry with the same key.
 *   3. A STARTED key blocks concurrent processing (returns CONFLICT).
 *   4. A COMPLETED key replays its cached response forever until it expires.
 *   5. TTL expiry evicts entries so expired keys are treated as new.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryKVStore, IdempotencyService } from '@/lib/backend/idempotency';

// ─── InMemoryKVStore ──────────────────────────────────────────────────────────

describe('InMemoryKVStore', () => {
  let store: InMemoryKVStore;

  beforeEach(() => {
    store = new InMemoryKVStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a key that has never been set', async () => {
    const result = await store.get('nonexistent');
    expect(result).toBeNull();
  });

  it('stores and retrieves a value', async () => {
    await store.set('key1', { foo: 'bar' }, 3600);
    const result = await store.get<{ foo: string }>('key1');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('stores different types (string, number, object, array)', async () => {
    await store.set('str', 'hello', 3600);
    await store.set('num', 42, 3600);
    await store.set('arr', [1, 2, 3], 3600);

    expect(await store.get('str')).toBe('hello');
    expect(await store.get('num')).toBe(42);
    expect(await store.get('arr')).toEqual([1, 2, 3]);
  });

  it('overwrites an existing key', async () => {
    await store.set('key1', 'first', 3600);
    await store.set('key1', 'second', 3600);
    expect(await store.get('key1')).toBe('second');
  });

  it('deletes a key', async () => {
    await store.set('key1', 'value', 3600);
    await store.delete('key1');
    expect(await store.get('key1')).toBeNull();
  });

  it('delete on a non-existent key does not throw', async () => {
    await expect(store.delete('missing')).resolves.toBeUndefined();
  });

  it('returns null for an expired entry', async () => {
    await store.set('ephemeral', 'data', 10); // 10 second TTL

    // Advance time past TTL
    vi.advanceTimersByTime(11_000);

    const result = await store.get('ephemeral');
    expect(result).toBeNull();
  });

  it('evicts the expired entry on get (lazy deletion)', async () => {
    await store.set('key', 'v', 5);
    vi.advanceTimersByTime(6_000);

    // First get: returns null and deletes
    expect(await store.get('key')).toBeNull();

    // The key is now gone, setting a new value works cleanly
    await store.set('key', 'new-value', 3600);
    expect(await store.get('key')).toBe('new-value');
  });

  it('does not expire an entry before the TTL elapses', async () => {
    await store.set('live', 'alive', 60);
    vi.advanceTimersByTime(30_000); // half the TTL

    expect(await store.get('live')).toBe('alive');
  });

  it('defaults TTL to 3600 seconds when not specified', async () => {
    await store.set('default-ttl', 'x');
    vi.advanceTimersByTime(3599_000);
    expect(await store.get('default-ttl')).toBe('x');

    vi.advanceTimersByTime(2_000); // push past 3600s
    expect(await store.get('default-ttl')).toBeNull();
  });

  it('cleanup() removes all expired entries', async () => {
    await store.set('a', 1, 5);
    await store.set('b', 2, 5);
    await store.set('c', 3, 300);

    vi.advanceTimersByTime(6_000);
    store.cleanup();

    // 'a' and 'b' should be gone
    expect(await store.get('a')).toBeNull();
    expect(await store.get('b')).toBeNull();
    // 'c' should still be present (300s TTL)
    expect(await store.get('c')).toBe(3);
  });

  it('cleanup() on an empty store does not throw', () => {
    expect(() => store.cleanup()).not.toThrow();
  });
});

// ─── IdempotencyService ───────────────────────────────────────────────────────

describe('IdempotencyService', () => {
  let kvStore: InMemoryKVStore;
  let service: IdempotencyService;

  beforeEach(() => {
    vi.useFakeTimers();
    kvStore = new InMemoryKVStore();
    service = new IdempotencyService(kvStore, 86400); // 24h TTL
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── getRecord ────────────────────────────────────────────────────────────

  describe('getRecord', () => {
    it('returns null for an unknown key', async () => {
      expect(await service.getRecord('unknown')).toBeNull();
    });

    it('returns a record after it has been started', async () => {
      await service.start('k1');
      const record = await service.getRecord('k1');

      expect(record).not.toBeNull();
      expect(record!.key).toBe('k1');
      expect(record!.status).toBe('STARTED');
    });

    it('returns null after fail() deletes the key', async () => {
      await service.start('k2');
      await service.fail('k2');

      expect(await service.getRecord('k2')).toBeNull();
    });
  });

  // ── start ────────────────────────────────────────────────────────────────

  describe('start', () => {
    it('creates a STARTED record and returns true', async () => {
      const result = await service.start('new-key');
      expect(result).toBe(true);

      const record = await service.getRecord('new-key');
      expect(record!.status).toBe('STARTED');
    });

    it('returns false and does not overwrite if the key already exists', async () => {
      await service.start('existing-key');
      const second = await service.start('existing-key');

      expect(second).toBe(false);

      // Record should still be the original STARTED record
      const record = await service.getRecord('existing-key');
      expect(record!.status).toBe('STARTED');
    });

    it('records createdAt and expiresAt on the record', async () => {
      const before = Date.now();
      await service.start('ts-key');
      const after = Date.now();

      const record = await service.getRecord('ts-key');
      expect(record!.createdAt).toBeGreaterThanOrEqual(before);
      expect(record!.createdAt).toBeLessThanOrEqual(after);
      expect(record!.expiresAt).toBeGreaterThan(record!.createdAt);
    });
  });

  // ── complete ─────────────────────────────────────────────────────────────

  describe('complete', () => {
    it('transitions a STARTED record to COMPLETED with the response payload', async () => {
      await service.start('key-c');
      const payload = { commitmentId: 'abc', txHash: '0x1' };
      await service.complete('key-c', payload, 200);

      const record = await service.getRecord('key-c');
      expect(record!.status).toBe('COMPLETED');
      expect(record!.response).toEqual(payload);
      expect(record!.statusCode).toBe(200);
    });

    it('defaults statusCode to 200 when not specified', async () => {
      await service.start('key-default');
      await service.complete('key-default', { ok: true });

      const record = await service.getRecord('key-default');
      expect(record!.statusCode).toBe(200);
    });

    it('can complete a key that was never started (idempotent write)', async () => {
      await service.complete('orphan-key', { data: 'x' }, 200);
      const record = await service.getRecord('orphan-key');
      expect(record).not.toBeNull();
      expect(record!.status).toBe('COMPLETED');
    });

    it('preserves the exact response payload without mutation', async () => {
      await service.start('immutable');
      const original = { fundedAt: '2026-08-01T00:00:00.000Z', txHash: '0xabc' };
      await service.complete('immutable', original, 200);

      const record = await service.getRecord<typeof original>('immutable');
      expect(record!.response).toEqual(original);
      expect(record!.response!.fundedAt).toBe('2026-08-01T00:00:00.000Z');
    });
  });

  // ── fail ─────────────────────────────────────────────────────────────────

  describe('fail', () => {
    it('deletes the key so getRecord returns null', async () => {
      await service.start('fail-key');
      await service.fail('fail-key');

      expect(await service.getRecord('fail-key')).toBeNull();
    });

    it('allows a retry after fail: start succeeds on the same key again', async () => {
      await service.start('retry-key');
      await service.fail('retry-key');

      // After fail, a new start on the same key should succeed
      const retryResult = await service.start('retry-key');
      expect(retryResult).toBe(true);

      const record = await service.getRecord('retry-key');
      expect(record!.status).toBe('STARTED');
    });

    it('does not throw when called on a non-existent key', async () => {
      await expect(service.fail('never-started')).resolves.toBeUndefined();
    });

    it('does not affect a different key', async () => {
      await service.start('key-a');
      await service.start('key-b');
      await service.fail('key-a');

      expect(await service.getRecord('key-a')).toBeNull();
      expect(await service.getRecord('key-b')).not.toBeNull();
    });
  });

  // ── TTL expiry ───────────────────────────────────────────────────────────

  describe('TTL expiry', () => {
    it('a COMPLETED record expires after the configured TTL', async () => {
      const shortLived = new IdempotencyService(kvStore, 10); // 10s TTL
      await shortLived.start('exp-key');
      await shortLived.complete('exp-key', { done: true }, 200);

      // Before expiry
      expect(await shortLived.getRecord('exp-key')).not.toBeNull();

      vi.advanceTimersByTime(11_000);

      // After expiry: key should be gone
      expect(await shortLived.getRecord('exp-key')).toBeNull();
    });

    it('an expired key allows a fresh start (treated as new)', async () => {
      const shortLived = new IdempotencyService(kvStore, 5); // 5s TTL
      await shortLived.start('reuse-key');
      await shortLived.complete('reuse-key', { v: 1 }, 200);

      vi.advanceTimersByTime(6_000); // past TTL

      const result = await shortLived.start('reuse-key');
      expect(result).toBe(true);
    });
  });

  // ── KV namespacing ───────────────────────────────────────────────────────

  describe('KV namespacing', () => {
    it('stores records under the idempotency: namespace prefix', async () => {
      await service.start('bare-key');

      // Direct KV access with the namespaced key
      const raw = await kvStore.get<{ key: string }>('idempotency:bare-key');
      expect(raw).not.toBeNull();
      expect(raw!.key).toBe('bare-key');

      // Direct KV access without the prefix should return null
      const unnamespaced = await kvStore.get('bare-key');
      expect(unnamespaced).toBeNull();
    });

    it('two different logical keys do not collide', async () => {
      await service.start('key-x');
      await service.complete('key-x', { value: 1 }, 200);
      await service.start('key-y');

      const x = await service.getRecord<{ value: number }>('key-x');
      const y = await service.getRecord('key-y');

      expect(x!.status).toBe('COMPLETED');
      expect(y!.status).toBe('STARTED');
    });
  });

  // ── Full lifecycle ───────────────────────────────────────────────────────

  describe('full idempotency lifecycle', () => {
    it('STARTED → COMPLETED → replay returns same data', async () => {
      const payload = { commitmentId: 'cmt-999', txHash: '0xfeed', fundedAt: '2026-09-01T00:00:00.000Z' };

      await service.start('lifecycle-1');
      let record = await service.getRecord('lifecycle-1');
      expect(record!.status).toBe('STARTED');

      await service.complete('lifecycle-1', payload, 200);
      record = await service.getRecord('lifecycle-1');
      expect(record!.status).toBe('COMPLETED');
      expect(record!.response).toEqual(payload);
      expect(record!.statusCode).toBe(200);

      // A second getRecord still returns the same COMPLETED record (idempotent replay)
      const replay = await service.getRecord<typeof payload>('lifecycle-1');
      expect(replay!.response!.fundedAt).toBe(payload.fundedAt);
    });

    it('STARTED → FAILED → STARTED (retry) → COMPLETED', async () => {
      await service.start('lifecycle-2');
      await service.fail('lifecycle-2'); // failure deletes the key

      // Retry: start should succeed on the now-deleted key
      const retryStart = await service.start('lifecycle-2');
      expect(retryStart).toBe(true);

      await service.complete('lifecycle-2', { result: 'ok' }, 200);
      const final = await service.getRecord('lifecycle-2');
      expect(final!.status).toBe('COMPLETED');
      expect(final!.response).toEqual({ result: 'ok' });
    });

    it('concurrent: second start returns false while first is STARTED', async () => {
      // Simulate two concurrent requests arriving with the same key
      const first = await service.start('concurrent');
      const second = await service.start('concurrent'); // should be blocked

      expect(first).toBe(true);
      expect(second).toBe(false);

      const record = await service.getRecord('concurrent');
      expect(record!.status).toBe('STARTED');
    });
  });
});
