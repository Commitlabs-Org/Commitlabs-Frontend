# Backend Storage and KV Consolidation

This document details the architectural consolidation of key-value and cache storage abstractions in the CommitLabs backend.

## The Canonical Abstraction: `StorageAdapter`

Going forward, the interface defined in `src/lib/backend/storage.ts` is the single canonical key-value and cache abstraction for the backend:

```typescript
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: StorageSetOptions): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, options?: StorageIncrementOptions): Promise<number>;
  getdel<T>(key: string): Promise<T | null>;
  expire(key: string, seconds: number): Promise<void>;
}
```

### Consolidation details

- **`storage.ts` & `kv.ts` consolidation**: The two files are fully unified. `kv.ts` now acts as a thin delegation layer to the singleton instance of `StorageAdapter` returned by `getStorageAdapter()`.
- **Unified Redis/Upstash connection**: If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in the environment, the `StorageAdapter` automatically configures a unified `UpstashKeyValueClient`, allowing rate limiting (`rateLimit.ts`) and general caching/services (`marketplace.ts`) to share a single Redis-based storage engine and client instance.
- **In-Memory fallback**: Local environments fall back seamlessly to `MemoryStorageAdapter` which completely mimics TTL and transaction behaviors using native JS maps and timers.
