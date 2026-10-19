/**
 * Thin, failure-tolerant wrapper around `localStorage`.
 *
 * `localStorage` is not always usable: Safari private mode throws on write,
 * quota can be exceeded, and content can be disabled entirely. Every helper
 * here degrades gracefully instead of throwing so callers never crash.
 */

/** Returns true when `localStorage` can be read from and written to. */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const probe = '__commitlabs_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Reads a key, returning null when missing or when storage is unavailable. */
export function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes a key. Returns false instead of throwing when the write fails
 * (private mode, quota exceeded, storage unavailable).
 */
export function writeRaw(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Removes a key, ignoring any failure. */
export function removeRaw(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Subscribes to `storage` events for a specific key (or all keys when the
 * event carries no key). Returns an unsubscribe function.
 */
export function subscribeStorage(key: string, handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: StorageEvent) => {
    if (event.key === null || event.key === key) handler();
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
