/**
 * Generic KV Store interface for CommitLabs Backend.
 * Supports standard Redis-like operations needed for auth and rate limiting.
 */
export interface KVStore {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    /**
     * Atomically gets the value and deletes the key.
     * Essential for single-use nonces to prevent replay attacks.
     */
    getdel<T>(key: string): Promise<T | null>;
    /**
     * Increments a counter and returns the new value.
     */
    incr(key: string): Promise<number>;
    /**
     * Sets a TTL on a key.
     */
    expire(key: string, seconds: number): Promise<void>;
}

/**
 * In-memory implementation for local development and testing.
 */
class MemoryKVStore implements KVStore {
    private store = new Map<string, { value: any; expiresAt: number | null }>();

    async get<T>(key: string): Promise<T | null> {
        const item = this.store.get(key);
        if (!item) return null;
        if (item.expiresAt && item.expiresAt < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return item.value as T;
    }

    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        this.store.set(key, {
            value,
            expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
        });
    }

    async del(key: string): Promise<void> {
        this.store.delete(key);
    }

    async getdel<T>(key: string): Promise<T | null> {
        const value = await this.get<T>(key);
        if (value !== null) {
            this.store.delete(key);
        }
        return value;
    }

    async incr(key: string): Promise<number> {
        const value = await this.get<number>(key) || 0;
        const newValue = value + 1;
        await this.set(key, newValue);
        return newValue;
    }

    async expire(key: string, seconds: number): Promise<void> {
        const item = this.store.get(key);
        if (item) {
            item.expiresAt = Date.now() + seconds * 1000;
        }
    }
}

/**
 * Redis-based implementation using Fetch API (Upstash compatible).
 * This avoids needing a thick Redis client in serverless environments.
 */
class UpstashKVStore implements KVStore {
    private url: string;
    private token: string;

    constructor(url: string, token: string) {
        this.url = url;
        this.token = token;
    }

    private async command(args: any[]) {
        const response = await fetch(`${this.url}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(args),
        });

        if (!response.ok) {
            throw new Error(`KV Store Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.result;
    }

    async get<T>(key: string): Promise<T | null> {
        const result = await this.command(['GET', key]);
        if (result === null) return null;
        try {
            return JSON.parse(result) as T;
        } catch {
            return result as T;
        }
    }

    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttlSeconds) {
            await this.command(['SET', key, valueStr, 'EX', ttlSeconds]);
        } else {
            await this.command(['SET', key, valueStr]);
        }
    }

    async del(key: string): Promise<void> {
        await this.command(['DEL', key]);
    }

    async getdel<T>(key: string): Promise<T | null> {
        // GETDEL is available in Redis 6.2+
        // Upstash supports it.
        const result = await this.command(['GETDEL', key]);
        if (result === null) return null;
        try {
            return JSON.parse(result) as T;
        } catch {
            return result as T;
        }
    }

    async incr(key: string): Promise<number> {
        return await this.command(['INCR', key]);
    }

    async expire(key: string, seconds: number): Promise<void> {
        await this.command(['EXPIRE', key, seconds]);
    }
}

// Singleton instance
let kvInstance: KVStore;

export function getKV(): KVStore {
    if (kvInstance) return kvInstance;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
        kvInstance = new UpstashKVStore(url, token);
    } else {
        if (process.env.NODE_ENV === 'production') {
            console.warn('KV Store: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set in production. Falling back to in-memory store.');
        }
        kvInstance = new MemoryKVStore();
    }

    return kvInstance;
}
