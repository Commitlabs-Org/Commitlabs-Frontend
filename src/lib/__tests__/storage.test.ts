import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStorageAvailable, readRaw, removeRaw, subscribeStorage, writeRaw } from '../storage';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('storage helpers', () => {
  describe('isStorageAvailable', () => {
    it('returns true when localStorage can be written to and removed from', () => {
      expect(isStorageAvailable()).toBe(true);
    });

    it('returns false when localStorage throws during the probe write', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      expect(isStorageAvailable()).toBe(false);
    });

    it('returns false when window is undefined', () => {
      vi.stubGlobal('window', undefined);

      expect(isStorageAvailable()).toBe(false);
    });
  });

  describe('readRaw', () => {
    it('returns null when getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
      });

      expect(readRaw('key')).toBeNull();
    });
  });

  describe('writeRaw', () => {
    it('returns false when setItem throws a quota error', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      expect(writeRaw('key', 'value')).toBe(false);
    });
  });

  describe('removeRaw', () => {
    it('swallows errors from removeItem', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
      });

      expect(() => removeRaw('key')).not.toThrow();
    });
  });

  describe('subscribeStorage', () => {
    it('fires for matching keys and events without a key, but ignores other keys', () => {
      const handler = vi.fn();
      subscribeStorage('matching-key', handler);

      window.dispatchEvent(new StorageEvent('storage', { key: 'other-key' }));
      expect(handler).not.toHaveBeenCalled();

      window.dispatchEvent(new StorageEvent('storage', { key: 'matching-key' }));
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('unsubscribes the storage event listener', () => {
      const handler = vi.fn();
      const unsubscribe = subscribeStorage('key', handler);

      unsubscribe();
      window.dispatchEvent(new StorageEvent('storage', { key: 'key' }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('returns a no-op unsubscribe function when window is undefined', () => {
      vi.stubGlobal('window', undefined);

      const unsubscribe = subscribeStorage('key', vi.fn());

      expect(() => unsubscribe()).not.toThrow();
    });
  });
});
