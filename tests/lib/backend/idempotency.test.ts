import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdempotencyService, InMemoryKVStore } from '@/lib/backend/idempotency';

describe('IdempotencyService with InMemoryKVStore', () => {
  let store: InMemoryKVStore;
  let service: IdempotencyService;
  const ttlSeconds = 60;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new InMemoryKVStore();
    service = new IdempotencyService(store, ttlSeconds);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle first call with a fresh key (creates STARTED record)', async () => {
    const key = 'test-key-1';
    
    // First call: start returns true (lock acquired)
    const success = await service.start(key);
    expect(success).toBe(true);

    const record = await service.getRecord(key);
    expect(record).not.toBeNull();
    expect(record?.status).toBe('STARTED');
    expect(record?.key).toBe(key);
  });

  it('should prevent concurrent/in-flight requests with the same key', async () => {
    const key = 'test-key-2';

    // First request starts
    const success1 = await service.start(key);
    expect(success1).toBe(true);

    // Second request tries to start concurrently
    const success2 = await service.start(key);
    expect(success2).toBe(false); // Conflict/already started

    const record = await service.getRecord(key);
    expect(record?.status).toBe('STARTED');
  });

  it('should transition from STARTED to COMPLETED and return the response/status code on replay', async () => {
    const key = 'test-key-3';
    const responseData = { success: true, data: 'some-data' };
    const statusCode = 200;

    // Start operation
    await service.start(key);

    // Complete operation
    await service.complete(key, responseData, statusCode);

    // Verify record state
    const record = await service.getRecord(key);
    expect(record?.status).toBe('COMPLETED');
    expect(record?.response).toEqual(responseData);
    expect(record?.statusCode).toBe(statusCode);

    // Try starting again (replay scenario)
    const successAfterComplete = await service.start(key);
    expect(successAfterComplete).toBe(false);
  });

  it('should handle the FAILED path by deleting the key to allow retries', async () => {
    const key = 'test-key-4';

    // Start operation
    await service.start(key);

    // Operation fails
    await service.fail(key);

    // Verify record is deleted (allowing retry)
    const record = await service.getRecord(key);
    expect(record).toBeNull();

    // Replay/retry after failure should be allowed (start returns true)
    const successRetry = await service.start(key);
    expect(successRetry).toBe(true);
  });

  it('should handle TTL expiry and remove the record using fake timers', async () => {
    const key = 'test-key-5';

    await service.start(key);

    // Advance time by 30 seconds (less than TTL)
    await vi.advanceTimersByTimeAsync(30 * 1000);
    let record = await service.getRecord(key);
    expect(record).not.toBeNull();

    // Advance time by another 31 seconds (total 61s, greater than TTL)
    await vi.advanceTimersByTimeAsync(31 * 1000);
    record = await service.getRecord(key);
    expect(record).toBeNull();
  });

  it('should clean up expired keys in InMemoryKVStore periodically', async () => {
    // Add an entry directly to the store
    await store.set('test-direct', { val: 123 }, 10);

    // Verify it exists
    expect(await store.get('test-direct')).not.toBeNull();

    // Advance time past expiry
    await vi.advanceTimersByTimeAsync(11 * 1000);

    // Trigger cleanup
    store.cleanup();

    // Verify it is removed
    expect(await store.get('test-direct')).toBeNull();
  });

  it('should use default store and TTL if none are provided', async () => {
    const defaultService = new IdempotencyService();
    // Default service should work without errors
    const success = await defaultService.start('default-key');
    expect(success).toBe(true);
    // Cleanup key
    await defaultService.fail('default-key');
  });

  it('should delete a non-existent key without error', async () => {
    await expect(store.delete('non-existent')).resolves.not.toThrow();
  });
});
