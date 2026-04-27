
export interface IdempotencyRecord<T = any> {
  key: string;
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  response?: T;
  statusCode?: number;
  createdAt: number;
  expiresAt: number;
}

export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * A simple in-memory KV store with TTL support.
 * Designed to be swapped with Redis or Vercel KV.
 */
class InMemoryKVStore implements KVStore {
  private store = new Map<string, { value: any; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Helper for cleanup (can be called periodically)
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

// Global instance for in-memory store
const globalStore = new InMemoryKVStore();

// Periodically clean up
if (typeof setInterval !== 'undefined') {
  setInterval(() => globalStore.cleanup(), 60 * 1000); // every minute
}

export class IdempotencyService {
  private store: KVStore;
  private ttlSeconds: number;

  constructor(store: KVStore = globalStore, ttlSeconds: number = 86400) { // Default 24h TTL
    this.store = store;
    this.ttlSeconds = ttlSeconds;
  }

  async getRecord<T>(key: string): Promise<IdempotencyRecord<T> | null> {
    return this.store.get<IdempotencyRecord<T>>(`idempotency:${key}`);
  }

  async start(key: string): Promise<boolean> {
    const existing = await this.getRecord(key);
    if (existing) {
      return false;
    }

    const record: IdempotencyRecord = {
      key,
      status: 'STARTED',
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    };

    await this.store.set(`idempotency:${key}`, record, this.ttlSeconds);
    return true;
  }

  async complete<T>(key: string, response: T, statusCode: number = 200): Promise<void> {
    const record: IdempotencyRecord<T> = {
      key,
      status: 'COMPLETED',
      response,
      statusCode,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    };

    await this.store.set(`idempotency:${key}`, record, this.ttlSeconds);
  }

  async fail(key: string): Promise<void> {
    // On failure, we might want to delete the key so it can be retried,
    // or mark it as FAILED. Here we delete it to allow retries.
    await this.store.delete(`idempotency:${key}`);
  }
}

export const idempotencyService = new IdempotencyService();
