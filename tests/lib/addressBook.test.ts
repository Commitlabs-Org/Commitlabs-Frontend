/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import {
  addEntry,
  clearAllEntries,
  getAllEntries,
  getEntry,
  removeEntry,
  updateEntry,
  __getStorageKey,
} from '@/lib/addressBook';

// Generated once for the whole suite via `Keypair.random()` so the addresses
// are guaranteed to satisfy `StrKey.isValidEd25519PublicKey`.
let VALID_ADDRESS_1: string;
let VALID_ADDRESS_2: string;

beforeAll(() => {
  VALID_ADDRESS_1 = Keypair.random().publicKey();
  VALID_ADDRESS_2 = Keypair.random().publicKey();
});

function badAddress(): string {
  // 56 chars but not a valid ed25519 public key.
  return 'G' + 'A'.repeat(55);
}

describe('addressBook', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('addEntry', () => {
    it('persists a valid entry and returns it with id + createdAt', () => {
      const entry = addEntry({
        address: VALID_ADDRESS_1,
        label: 'Treasury',
      });

      expect(entry.id).toBeTruthy();
      expect(entry.address).toBe(VALID_ADDRESS_1);
      expect(entry.label).toBe('Treasury');
      expect(typeof entry.createdAt).toBe('number');
      expect(entry.createdAt).toBeGreaterThan(0);

      const stored = window.localStorage.getItem(__getStorageKey());
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored as string);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].address).toBe(VALID_ADDRESS_1);
    });

    it('rejects an invalid Stellar address', () => {
      expect(() =>
        addEntry({ address: badAddress(), label: 'Bad' }),
      ).toThrow(/address must be a valid Stellar ed25519 public key/);
      expect(getAllEntries()).toHaveLength(0);
    });

    it('rejects an empty label', () => {
      expect(() =>
        addEntry({ address: VALID_ADDRESS_1, label: '' }),
      ).toThrow(/label must be a non-empty string/);
      expect(getAllEntries()).toHaveLength(0);
    });

    it('rejects an over-long label', () => {
      expect(() =>
        addEntry({
          address: VALID_ADDRESS_1,
          label: 'x'.repeat(51),
        }),
      ).toThrow(/label must be at most 50 characters/);
      expect(getAllEntries()).toHaveLength(0);
    });

    it('accepts the maximum-length label (50 chars)', () => {
      const entry = addEntry({
        address: VALID_ADDRESS_1,
        label: 'x'.repeat(50),
      });
      expect(entry.label).toHaveLength(50);
    });

    it('does not corrupt storage when addEntry throws', () => {
      expect(() =>
        addEntry({ address: badAddress(), label: 'Bad' }),
      ).toThrow();
      const stored = window.localStorage.getItem(__getStorageKey());
      // Either unset, empty, or empty array — never partial / corrupt.
      expect(stored === null || stored === '' || stored === '[]').toBe(true);
    });
  });

  describe('getAllEntries', () => {
    it('returns an empty array when storage is empty', () => {
      expect(getAllEntries()).toEqual([]);
    });

    it('returns entries sorted newest-first by createdAt', () => {
      // Insert with distinct, monotonically-increasing timestamps so the
      // sort is deterministic regardless of clock resolution.
      const first = addEntry({ address: VALID_ADDRESS_1, label: 'First' });
      const second = addEntry({ address: VALID_ADDRESS_2, label: 'Second' });

      // Force distinct timestamps in storage (Date.now() can collide when
      // entries are added within the same millisecond).
      const raw = window.localStorage.getItem(__getStorageKey())!;
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      for (const entry of parsed) {
        if (entry.id === first.id) entry.createdAt = 100;
        if (entry.id === second.id) entry.createdAt = 200;
      }
      window.localStorage.setItem(__getStorageKey(), JSON.stringify(parsed));

      const entries = getAllEntries();
      expect(entries.map((e) => e.label)).toEqual(['Second', 'First']);
      expect(entries).toHaveLength(2);
      expect(new Set(entries.map((e) => e.id))).toEqual(
        new Set([first.id, second.id]),
      );
    });

    it('silently drops invalid entries already in storage', () => {
      window.localStorage.setItem(
        __getStorageKey(),
        JSON.stringify([
          { id: 'good', address: VALID_ADDRESS_1, label: 'Good', createdAt: 1 },
          { id: 'bad-address', address: 'NOT-AN-ADDRESS', label: 'x', createdAt: 2 },
          { id: 'bad-label', address: VALID_ADDRESS_1, label: '', createdAt: 3 },
          'a string, not an object',
          null,
        ]),
      );

      const entries = getAllEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('good');
    });

    it('treats corrupt JSON as an empty address book', () => {
      window.localStorage.setItem(__getStorageKey(), '{not json');
      expect(getAllEntries()).toEqual([]);
    });

    it('treats non-array JSON as an empty address book', () => {
      window.localStorage.setItem(__getStorageKey(), JSON.stringify({ foo: 1 }));
      expect(getAllEntries()).toEqual([]);
    });
  });

  describe('getEntry', () => {
    it('returns the matching entry', () => {
      const added = addEntry({ address: VALID_ADDRESS_1, label: 'Main' });
      const fetched = getEntry(added.id);
      expect(fetched).toEqual(added);
    });

    it('returns undefined when the id does not exist', () => {
      expect(getEntry('does-not-exist')).toBeUndefined();
    });
  });

  describe('updateEntry', () => {
    it('patches a label', () => {
      const entry = addEntry({ address: VALID_ADDRESS_1, label: 'Old' });
      const updated = updateEntry(entry.id, { label: 'New' });
      expect(updated?.label).toBe('New');
      expect(updated?.address).toBe(VALID_ADDRESS_1);
    });

    it('patches an address when the new value is valid', () => {
      const entry = addEntry({ address: VALID_ADDRESS_1, label: 'Main' });
      const updated = updateEntry(entry.id, { address: VALID_ADDRESS_2 });
      expect(updated?.address).toBe(VALID_ADDRESS_2);
    });

    it('rejects an update that would produce an invalid address', () => {
      const entry = addEntry({ address: VALID_ADDRESS_1, label: 'Main' });
      expect(() =>
        updateEntry(entry.id, { address: badAddress() }),
      ).toThrow(/address must be a valid Stellar ed25519 public key/);

      const after = getEntry(entry.id);
      expect(after?.address).toBe(VALID_ADDRESS_1); // unchanged
    });

    it('rejects an update that would produce an empty label', () => {
      const entry = addEntry({ address: VALID_ADDRESS_1, label: 'Main' });
      expect(() => updateEntry(entry.id, { label: '' })).toThrow(
        /label must be a non-empty string/,
      );
      const after = getEntry(entry.id);
      expect(after?.label).toBe('Main');
    });

    it('returns undefined when the entry does not exist', () => {
      expect(updateEntry('missing', { label: 'Whatever' })).toBeUndefined();
    });

    it('does not change createdAt or id when patching', () => {
      const entry = addEntry({ address: VALID_ADDRESS_1, label: 'Main' });
      const before = getEntry(entry.id);
      const updated = updateEntry(entry.id, { label: 'Renamed' });
      expect(updated?.id).toBe(before?.id);
      expect(updated?.createdAt).toBe(before?.createdAt);
    });
  });

  describe('removeEntry', () => {
    it('removes an existing entry and returns true', () => {
      const entry = addEntry({ address: VALID_ADDRESS_1, label: 'Main' });
      expect(removeEntry(entry.id)).toBe(true);
      expect(getEntry(entry.id)).toBeUndefined();
    });

    it('returns false when removing a non-existent entry', () => {
      expect(removeEntry('not-there')).toBe(false);
    });
  });

  describe('clearAllEntries', () => {
    it('removes the storage key entirely', () => {
      addEntry({ address: VALID_ADDRESS_1, label: 'Main' });
      expect(getAllEntries()).toHaveLength(1);
      clearAllEntries();
      expect(getAllEntries()).toHaveLength(0);
      expect(window.localStorage.getItem(__getStorageKey())).toBeNull();
    });
  });

  });