import type { CacheAdapter } from './index';
import { MemoryAdapter } from './memory';
import { RedisAdapter } from './redis';

function createAdapter(): CacheAdapter {
  const forced = process.env.CACHE_ADAPTER;
  const redisUrl = process.env.REDIS_URL;

  const useRedis =
    forced === 'redis' ||
    (forced !== 'memory' &&
      process.env.NODE_ENV === 'production' &&
      !!redisUrl);

  if (useRedis) {
    if (!redisUrl) {
      throw new Error(
        'REDIS_URL must be set when CACHE_ADAPTER=redis or in production with Redis enabled.',
      );
    }
    return new RedisAdapter(redisUrl);
  }

  return new MemoryAdapter();
}

/**
 * Module-level singleton. Created once at startup.
 * In tests, replace via: vi.mock('@/lib/backend/cache/factory', () => ({ cache: mockCache }))
 */
export const cache: CacheAdapter = createAdapter();
