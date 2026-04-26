import type { CacheAdapter } from './index';

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryAdapter implements CacheAdapter {
  private readonly store = new Map<string, Entry<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async invalidate(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /** Wipes all entries — useful in test beforeEach hooks. */
  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
