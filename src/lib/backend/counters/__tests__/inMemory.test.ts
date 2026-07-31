import { InMemoryCounters } from '../inMemory';

describe('InMemoryCounters', () => {
  let counters: InMemoryCounters;

  beforeEach(() => {
    counters = new InMemoryCounters();
  });

  describe('incrementRateLimitBlocks', () => {
    it('should increment the rate limit blocks counter', async () => {
      expect(counters['rateLimitBlocks']).toBe(0);
      await counters.incrementRateLimitBlocks();
      expect(counters['rateLimitBlocks']).toBe(1);
      await counters.incrementRateLimitBlocks();
      expect(counters['rateLimitBlocks']).toBe(2);
    });
  });

  describe('incrementAuthFailures', () => {
    it('should increment the auth failures counter', async () => {
      expect(counters['authFailures']).toBe(0);
      await counters.incrementAuthFailures();
      expect(counters['authFailures']).toBe(1);
      await counters.incrementAuthFailures();
      expect(counters['authFailures']).toBe(2);
    });
  });

  describe('incrementChainFailures', () => {
    it('should increment the chain failures counter', async () => {
      expect(counters['chainFailures']).toBe(0);
      await counters.incrementChainFailures();
      expect(counters['chainFailures']).toBe(1);
      await counters.incrementChainFailures();
      expect(counters['chainFailures']).toBe(2);
    });
  });

  describe('incrementSuccessfulActions', () => {
    it('should increment the successful actions counter', async () => {
      expect(counters['successfulActions']).toBe(0);
      await counters.incrementSuccessfulActions();
      expect(counters['successfulActions']).toBe(1);
      await counters.incrementSuccessfulActions();
      expect(counters['successfulActions']).toBe(2);
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

      expect(counters['rateLimitBlocks']).toBe(1);
      expect(counters['authFailures']).toBe(1);
      expect(counters['chainFailures']).toBe(1);
      expect(counters['successfulActions']).toBe(1);

      await counters.reset();

      expect(counters['rateLimitBlocks']).toBe(0);
      expect(counters['authFailures']).toBe(0);
      expect(counters['chainFailures']).toBe(0);
      expect(counters['successfulActions']).toBe(0);
    });
  });
});
