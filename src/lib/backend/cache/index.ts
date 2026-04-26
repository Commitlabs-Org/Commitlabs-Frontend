/*
 * Cache adapter module for Commitlabs backend.
 *
 * Two adapters ship with this module:
 *   - MemoryAdapter  default for NODE_ENV=test|development. Zero dependencies,
 *                    TTL enforced on read, safe to use across test runs.
 *   - RedisAdapter   used when NODE_ENV=production and REDIS_URL is set (or when
 *                    CACHE_ADAPTER=redis is explicitly set). Requires ioredis:
 *                    `npm install ioredis`
 *
 * The active adapter is selected in factory.ts at module load time. To override
 * the default selection set CACHE_ADAPTER=redis|memory in your environment.
 *
 * All keys are namespaced under "commitlabs:" to avoid collisions with other
 * tenants sharing the same Redis instance.
 */

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Remove every key whose name starts with `prefix`. */
  invalidate(prefix: string): Promise<void>;
}

export const CacheKey = {
  commitment: (id: string) => `commitlabs:commitment:${id}`,
  userCommitments: (ownerAddress: string) =>
    `commitlabs:user-commitments:${ownerAddress}`,
  marketplaceListings: (queryHash: string) =>
    `commitlabs:marketplace:listings:${queryHash}`,
} as const;

/** TTL in seconds — keep short so stale chain data doesn't linger. */
export const CacheTTL = {
  COMMITMENT_DETAIL: 30,
  USER_COMMITMENTS: 20,
  MARKETPLACE_LISTINGS: 15,
} as const;
