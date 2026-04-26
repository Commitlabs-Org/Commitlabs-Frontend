import { CountersAdapter } from './adapters';

// We'll use ioredis as the Redis client. In a real setup, you would install ioredis.
// For the purpose of this task, we assume it's available or we mock it in tests.
import Redis from 'ioredis';

export class PersistentCounters implements CountersAdapter {
  private redis: Redis;
  private readonly keyPrefix = 'commitlabs:metrics:';

  constructor(redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.redis = new Redis(redisUrl);
  }

  private async getKey(name: string): Promise<string> {
    return `${this.keyPrefix}${name}`;
  }

  async incrementRateLimitBlocks(): void {
    const key = await this.getKey('rate_limit_blocks');
    await this.redis.incr(key);
  }

  async incrementAuthFailures(): void {
    const key = await this.getKey('auth_failures');
    await this.redis.incr(key);
  }

  async incrementChainFailures(): void {
    const key = await this.getKey('chain_failures');
    await this.redis.incr(key);
  }

  async incrementSuccessfulActions(): void {
    const key = await this.getKey('successful_actions');
    await this.redis.incr(key);
  }

  async getMetrics(): Promise<{
    rate_limit_blocks: number;
    auth_failures: number;
    chain_failures: number;
    successful_actions: number;
    timestamp: string;
  }> {
    const [rateLimitBlocks, authFailures, chainFailures, successfulActions] = await this.redis.mget(
      await this.getKey('rate_limit_blocks'),
      await this.getKey('auth_failures'),
      await this.getKey('chain_failures'),
      await this.getKey('successful_actions')
    );

    return {
      rate_limit_blocks: parseInt(rateLimitBlocks || '0', 10),
      auth_failures: parseInt(authFailures || '0', 10),
      chain_failures: parseInt(chainFailures || '0', 10),
      successful_actions: parseInt(successfulActions || '0', 10),
      timestamp: new Date().toISOString(),
    };
  }

  async reset(): void {
    // Only for testing: delete the keys
    const keys = [
      await this.getKey('rate_limit_blocks'),
      await this.getKey('auth_failures'),
      await this.getKey('chain_failures'),
      await this.getKey('successful_actions'),
    ];
    await this.redis.del(...keys);
  }

  // Close the Redis connection when the application shuts down (if needed)
  async close(): Promise<void> {
    await this.redis.quit();
  }
}