// @vitest-environment happy-dom
/**
 * Tests for src/lib/addressBook.ts — the browser-side, validated
 * persistent address book for Stellar addresses. Requires happy-dom
 * (or jsdom) so that `window.localStorage` is available; the module
 * no-ops on the server by design but is only meaningful in the browser.
 *
 * `Buffer` is not provided by happy-dom; we therefore hardcode three
 * deterministic, well-formed Stellar StrKey Ed25519 public keys generated
 * via `StrKey.encodeEd25519PublicKey(Buffer.alloc(32, N))` for N in {1,2,3}.
 * They are publicly verifiable (anyone can encode the same byte sequence)
 * and are used here purely as inputs to `StrKey.isValidEd25519PublicKey`.
 */
import { StrKey } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADDRESS_BOOK_STORAGE_KEY,
  __resetAddressBookForTests,
  add,
  clear,
  getAll,
  labelFor,
  load,
  remove,
  update,
} from '../../src/lib/addressBook';

const VALID_KEY_A = 'GAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQDZ7H';
const VALID_KEY_B = 'GABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEJXA';
const VALID_KEY_C = 'GABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQHGPC';

beforeEach(() => {
  __resetAddressBookForTests();
});

afterEach(() => {
  __resetAddressBookForTests();
});

describe('addressBook — load()', () => {
  it('returns an empty array when storage is empty', () => {
    expect(load()).toEqual([]);
    expect(getAll()).toEqual([]);
  });

  it('returns an empty array when stored value is not valid JSON', () => {
    window.localStorage.setItem(ADDRESS_BOOK_STORAGE_KEY, '{not json');
    expect(load()).toEqual([]);
  });

  it('returns an empty array when stored value is the wrong shape', () => {
    window.localStorage.setItem(ADDRESS_BOOK_STORAGE_KEY, JSON.stringify({ id: 'oops' }));
    expect(load()).toEqual([]);
  });

  it('drops malformed entries but keeps well-formed ones', () => {
    const good = {
      id: 'i-1',
      address: VALID_KEY_A,
      label: 'Treasury',
    };
    const notAnObject = 'string';
    const badAddress = {
      id: 'i-2',
      address: 'NOT-A-VALID-STRKEY',
      label: 'Bad',
    };
    const missingLabel = {
      id: 'i-3',
      address: VALID_KEY_B,
    };
    window.localStorage.setItem(
      ADDRESS_BOOK_STORAGE_KEY,
      JSON.stringify([good, notAnObject, badAddress, missingLabel]),
    );

    expect(load()).toEqual([good]);
  });
});

describe('addressBook — add()', () => {
  it('persists a new entry with a generated id', () => {
    const entry = add(VALID_KEY_A, 'Treasury');
    expect(entry.address).toBe(VALID_KEY_A);
    expect(entry.label).toBe('Treasury');
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
    expect(getAll()).toEqual([entry]);
  });

  it('updates the label when the same address is added twice', () => {
    add(VALID_KEY_A, 'Treasury');
    const second = add(VALID_KEY_A, 'Primary Treasury');
    expect(second.label).toBe('Primary Treasury');
    expect(getAll()).toHaveLength(1);
    expect(getAll()[0].label).toBe('Primary Treasury');
  });

  it('rejects invalid Stellar addresses', () => {
    expect(() => add('NOT-AN-ADDRESS', 'Treasury')).toThrow(/Stellar StrKey/);
  });

  it('rejects non-string addresses and labels', () => {
    expect(() => add(VALID_KEY_A as unknown as string, 123 as unknown as string)).toThrow(
      /label must be a string/,
    );
    expect(() => add(123 as unknown as string, 'x')).toThrow(/address must be a string/);
  });
});

describe('addressBook — update()', () => {
  it('patches label of an existing entry', () => {
    const entry = add(VALID_KEY_A, 'Treasury');
    const updated = update(entry.id, { label: 'Primary Treasury' });
    expect(updated?.label).toBe('Primary Treasury');
    expect(getAll()[0].label).toBe('Primary Treasury');
  });

  it('patches address and validates the new value', () => {
    const entry = add(VALID_KEY_A, 'Treasury');
    const updated = update(entry.id, { address: VALID_KEY_B });
    expect(updated?.address).toBe(VALID_KEY_B);
    expect(getAll()[0].address).toBe(VALID_KEY_B);
  });

  it('returns null when no entry matches the id', () => {
    expect(update('does-not-exist', { label: 'x' })).toBeNull();
  });

  it('rejects an invalid replacement address', () => {
    const entry = add(VALID_KEY_A, 'Treasury');
    expect(() => update(entry.id, { address: 'NOT-A-VALID-STRKEY' })).toThrow(/Stellar StrKey/);
  });
});

describe('addressBook — remove() / clear() / labelFor()', () => {
  it('removes a specific entry by id', () => {
    const a = add(VALID_KEY_A, 'A');
    const b = add(VALID_KEY_B, 'B');
    expect(remove(a.id)).toBe(true);
    expect(getAll()).toEqual([b]);
    expect(remove('nope')).toBe(false);
  });

  it('clear() removes every entry', () => {
    add(VALID_KEY_A, 'A');
    add(VALID_KEY_B, 'B');
    clear();
    expect(getAll()).toEqual([]);
  });

  it('labelFor looks up by address', () => {
    add(VALID_KEY_A, 'Treasury');
    add(VALID_KEY_B, 'Hot wallet');
    expect(labelFor(VALID_KEY_A)).toBe('Treasury');
    expect(labelFor(VALID_KEY_B)).toBe('Hot wallet');
    expect(labelFor(VALID_KEY_C)).toBeUndefined();
  });

  it('labelFor rejects malformed addresses', () => {
    add(VALID_KEY_A, 'Treasury');
    expect(labelFor('NOT-AN-ADDRESS')).toBeUndefined();
  });
});
