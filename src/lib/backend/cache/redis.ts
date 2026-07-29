import type { CacheAdapter } from './index';
import { logError } from '@/lib/backend/logger';

/*
 * RedisAdapter wraps ioredis. Install it before enabling this adapter:
 *   npm install ioredis
 *
 * The client is created lazily so the module loads cleanly even when ioredis
 * is absent — the error only surfaces at runtime when production traffic
 * actually tries to use this adapter.
 *
 * REDIS_URL may include credentials:
 *   redis://:password@host:6379/0
 *   rediss://:password@host:6379/0   (TLS)
 * ioredis parses the URL and sets up authentication automatically.
 */

// Declared here for type inference without importing ioredis at module load.
type IoRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex: 'EX', seconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  scan(
    cursor: string,
    matchArg: 'MATCH',
    pattern: string,
    countArg: 'COUNT',
    count: number,
  ): Promise<[string, string[]]>;
  quit(): Promise<unknown>;
};

export class RedisAdapter implements CacheAdapter {
  private client: IoRedis | null = null;

  constructor(private readonly redisUrl: string) {}

  private getClient(): IoRedis {
    if (!this.client) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      this.client = new Redis(this.redisUrl, {
        lazyConnect: true,
        enableReadyCheck: false,
        maxRetriesPerRequest: 2,
      }) as IoRedis;
    }
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.getClient().get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      logError(undefined, '[RedisAdapter] get failed', err as Error, { key });
      return null; // fail open — fall through to chain read
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logError(undefined, '[RedisAdapter] set failed', err as Error, { key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.getClient().del(key);
    } catch (err) {
      logError(undefined, '[RedisAdapter] delete failed', err as Error, { key });
    }
  }

  async invalidate(prefix: string): Promise<void> {
    try {
      const client = this.getClient();
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) await client.del(...keys);
      } while (cursor !== '0');
    } catch (err) {
      logError(undefined, '[RedisAdapter] invalidate failed', err as Error, {
        prefix,
      });
    }
  }

  async disconnect(): Promise<void> {
    await this.client?.quit();
    this.client = null;
  }
}
