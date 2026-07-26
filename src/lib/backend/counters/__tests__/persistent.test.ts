import { PersistentCounters } from '../persistent';
import { vi } from 'vitest';

// Mock ioredis
const mockRedisData = new Map<string, number>();

vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      constructor() {
        // No-op constructor
      }
      incr(key) {
        const val = mockRedisData.get(key) || 0;
        mockRedisData.set(key, val + 1);
        return Promise.resolve(val + 1);
      }
      mget(...keys) {
        const values = keys.map(key => mockRedisData.get(key) || null);
        return Promise.resolve(values);
      }
      del(...keys) {
        keys.forEach(key => mockRedisData.delete(key));
        return Promise.resolve(keys.length);
      }
      quit() {
        return Promise.resolve();
      }
    }
  };
});

describe('PersistentCounters', () => {
  let counters: PersistentCounters;

  beforeEach(() => {
    // Clear the mock data before each test
    mockRedisData.clear();
    counters = new PersistentCounters('redis://localhost:6379');
  });

  describe('incrementRateLimitBlocks', () => {
    it('should increment the rate limit blocks counter in Redis', async () => {
      await counters.incrementRateLimitBlocks();
      await counters.incrementRateLimitBlocks();
      
      const key = `commitlabs:metrics:rate_limit_blocks`;
      const value = mockRedisData.get(key);
      expect(value).toBe(2);
    });
  });

  describe('incrementAuthFailures', () => {
    it('should increment the auth failures counter in Redis', async () => {
      await counters.incrementAuthFailures();
      await counters.incrementAuthFailures();
      
      const key = `commitlabs:metrics:auth_failures`;
      const value = mockRedisData.get(key);
      expect(value).toBe(2);
    });
  });

  describe('incrementChainFailures', () => {
    it('should increment the chain failures counter in Redis', async () => {
      await counters.incrementChainFailures();
      await counters.incrementChainFailures();
      
      const key = `commitlabs:metrics:chain_failures`;
      const value = mockRedisData.get(key);
      expect(value).toBe(2);
    });
  });

  describe('incrementSuccessfulActions', () => {
    it('should increment the successful actions counter in Redis', async () => {
      await counters.incrementSuccessfulActions();
      await counters.incrementSuccessfulActions();
      
      const key = `commitlabs:metrics:successful_actions`;
      const value = mockRedisData.get(key);
      expect(value).toBe(2);
    });
  });

  describe('getMetrics', () => {
    it('should return the current metrics with correct initial values', async () => {
      const metrics = await counters.getMetrics();
      expect(metrics).toEqual({
        rate_limit_blocks: 0,
        auth_failures: 0,
        chain_failures: 0,
        successful_actions: 0,
        timestamp: expect.any(String),
      });
    });

    it('should return updated metrics after increments', async () => {
      await counters.incrementRateLimitBlocks();
      await counters.incrementRateLimitBlocks();
      await counters.incrementAuthFailures();
      await counters.incrementChainFailures();
      await counters.incrementChainFailures();
      await counters.incrementChainFailures();
      await counters.incrementSuccessfulActions();
      await counters.incrementSuccessfulActions();
      
      const metrics = await counters.getMetrics();
      expect(metrics).toEqual({
        rate_limit_blocks: 2,
        auth_failures: 1,
        chain_failures: 3,
        successful_actions: 2,
        timestamp: expect.any(String),
      });
    });
  });

  describe('reset', () => {
    it('should reset all counters to zero', async () => {
      await counters.incrementRateLimitBlocks();
      await counters.incrementAuthFailures();
      await counters.incrementChainFailures();
      await counters.incrementSuccessfulActions();
      
      await counters.reset();
      
      const metrics = await counters.getMetrics();
      expect(metrics).toEqual({
        rate_limit_blocks: 0,
        auth_failures: 0,
        chain_failures: 0,
        successful_actions: 0,
        timestamp: expect.any(String),
      });
    });
  });
});