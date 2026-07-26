import { logError, logWarn } from './logger';

export interface StorageSetOptions {
  ttlMs?: number;
}

export interface StorageIncrementOptions extends StorageSetOptions {
  amount?: number;
}

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: StorageSetOptions): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, options?: StorageIncrementOptions): Promise<number>;
}

interface MemoryStorageEntry {
  value: unknown;
  expiresAt?: number;
}

export interface KeyValueClient {
  get(key: string): Promise<string | null | undefined>;
  set(
    key: string,
    value: string,
    options?: { ttlSeconds?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, amount?: number): Promise<number>;
  expire?(key: string, ttlSeconds: number): Promise<void>;
}

export type StorageProvider = 'memory' | 'redis' | 'kv';

export interface CreateStorageOptions {
  provider?: StorageProvider;
  client?: KeyValueClient;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, MemoryStorageEntry>();

  private sweepExpired(key: string): void {
    const entry = this.store.get(key);
    if (!entry?.expiresAt) return;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.sweepExpired(key);
    const entry = this.store.get(key);
    return (entry?.value as T | undefined) ?? null;
  }

  async set<T>(
    key: string,
    value: T,
    options?: StorageSetOptions,
  ): Promise<void> {
    const expiresAt =
      options?.ttlMs !== undefined ? Date.now() + options.ttlMs : undefined;

    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async increment(
    key: string,
    options?: StorageIncrementOptions,
  ): Promise<number> {
    this.sweepExpired(key);

    const amount = options?.amount ?? 1;
    const currentEntry = this.store.get(key);
    const currentValue =
      typeof currentEntry?.value === 'number' ? currentEntry.value : 0;
    const nextValue = currentValue + amount;

    const expiresAt =
      currentEntry?.expiresAt ??
      (options?.ttlMs !== undefined ? Date.now() + options.ttlMs : undefined);

    this.store.set(key, {
      value: nextValue,
      expiresAt,
    });

    return nextValue;
  }

  reset(): void {
    this.store.clear();
  }
}

export class KeyValueStorageAdapter implements StorageAdapter {
  constructor(private readonly client: KeyValueClient) {}

  private normalizeError(operation: string, error: unknown): Error {
    const normalized = error instanceof Error ? error : new Error(String(error));
    logError(
      undefined,
      `[Storage] ${operation} failed`,
      normalized,
    );
    return new Error('Storage operation failed');
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (raw === null || raw === undefined) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      throw this.normalizeError('get', error);
    }
  }

  async set<T>(
    key: string,
    value: T,
    options?: StorageSetOptions,
  ): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), {
        ttlSeconds:
          options?.ttlMs !== undefined
            ? Math.max(1, Math.ceil(options.ttlMs / 1000))
            : undefined,
      });
    } catch (error) {
      throw this.normalizeError('set', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.delete(key);
    } catch (error) {
      throw this.normalizeError('delete', error);
    }
  }

  async increment(
    key: string,
    options?: StorageIncrementOptions,
  ): Promise<number> {
    try {
      const nextValue = await this.client.increment(key, options?.amount ?? 1);

      if (options?.ttlMs !== undefined && this.client.expire) {
        await this.client.expire(
          key,
          Math.max(1, Math.ceil(options.ttlMs / 1000)),
        );
      } else if (options?.ttlMs !== undefined && !this.client.expire) {
        logWarn(
          undefined,
          '[Storage] TTL requested for increment but provider does not support expire',
          { key },
        );
      }

      return nextValue;
    } catch (error) {
      throw this.normalizeError('increment', error);
    }
  }
}

function resolveProvider(provider?: StorageProvider): StorageProvider {
  const configured = provider ?? process.env.COMMITLABS_STORAGE_PROVIDER;

  if (
    configured === 'memory' ||
    configured === 'redis' ||
    configured === 'kv'
  ) {
    return configured;
  }

  return 'memory';
}

let cachedStorage: StorageAdapter | null = null;

export function createStorageAdapter(
  options: CreateStorageOptions = {},
): StorageAdapter {
  const provider = resolveProvider(options.provider);

  if (provider === 'redis' || provider === 'kv') {
    if (options.client) {
      return new KeyValueStorageAdapter(options.client);
    }

    logWarn(
      undefined,
      '[Storage] External storage provider requested without a configured client. Falling back to memory storage.',
      { provider },
    );
  }

  return new MemoryStorageAdapter();
}

export function getStorageAdapter(): StorageAdapter {
  if (!cachedStorage) {
    cachedStorage = createStorageAdapter();
  }

  return cachedStorage;
}

export function configureStorageAdapterForTests(
  adapter: StorageAdapter | null,
): void {
  cachedStorage = adapter;
}

export function resetStorageAdapterForTests(): void {
  if (cachedStorage instanceof MemoryStorageAdapter) {
    cachedStorage.reset();
  }
}
