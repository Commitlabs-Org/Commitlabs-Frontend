import { InMemoryCounters } from '../inMemory';

describe('InMemoryCounters', () => {
  let counters: InMemoryCounters;

  beforeEach(() => {
    counters = new InMemoryCounters();
  });

  describe('incrementRateLimitBlocks', () => {
    it('should increment the rate limit blocks counter', () => {
      expect(counters['rateLimitBlocks']).toBe(0);
      counters.incrementRateLimitBlocks();
      expect(counters['rateLimitBlocks']).toBe(1);
      counters.incrementRateLimitBlocks();
      expect(counters['rateLimitBlocks']).toBe(2);
    });
  });

  describe('incrementAuthFailures', () => {
    it('should increment the auth failures counter', () => {
      expect(counters['authFailures']).toBe(0);
      counters.incrementAuthFailures();
      expect(counters['authFailures']).toBe(1);
      counters.incrementAuthFailures();
      expect(counters['authFailures']).toBe(2);
    });
  });

  describe('incrementChainFailures', () => {
    it('should increment the chain failures counter', () => {
      expect(counters['chainFailures']).toBe(0);
      counters.incrementChainFailures();
      expect(counters['chainFailures']).toBe(1);
      counters.incrementChainFailures();
      expect(counters['chainFailures']).toBe(2);
    });
  });

  describe('incrementSuccessfulActions', () => {
    it('should increment the successful actions counter', () => {
      expect(counters['successfulActions']).toBe(0);
      counters.incrementSuccessfulActions();
      expect(counters['successfulActions']).toBe(1);
      counters.incrementSuccessfulActions();
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
      counters.incrementRateLimitBlocks();
      counters.incrementRateLimitBlocks();
      counters.incrementAuthFailures();
      counters.incrementChainFailures();
      counters.incrementChainFailures();
      counters.incrementChainFailures();
      counters.incrementSuccessfulActions();
      counters.incrementSuccessfulActions();

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
    it('should reset all counters to zero', () => {
      counters.incrementRateLimitBlocks();
      counters.incrementAuthFailures();
      counters.incrementChainFailures();
      counters.incrementSuccessfulActions();

      expect(counters['rateLimitBlocks']).toBe(1);
      expect(counters['authFailures']).toBe(1);
      expect(counters['chainFailures']).toBe(1);
      expect(counters['successfulActions']).toBe(1);

      counters.reset();

      expect(counters['rateLimitBlocks']).toBe(0);
      expect(counters['authFailures']).toBe(0);
      expect(counters['chainFailures']).toBe(0);
      expect(counters['successfulActions']).toBe(0);
    });
  });
});