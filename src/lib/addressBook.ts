/**
 * Browser-side address book for frequently-used Stellar addresses.
 *
 * The address book is persisted to `window.localStorage` under the
 * `commitlabs:address-book` key. Every entry written to the store and every
 * value loaded from storage is validated at runtime:
 *
 *   - `id`, `address`, and `label` must be strings
 *   - `address` must be a valid Stellar StrKey (Ed25519 public key, `G...`)
 *
 * Corrupted or malformed storage (manually edited, partial writes, schema
 * mismatches) is treated as an empty address book rather than being trusted
 * silently. This avoids flowing unsanitized data into the rest of the app.
 *
 * NOTE: This module is browser-only. All reads/writes guard against
 * `typeof window === 'undefined'` so it can be safely imported by code that
 * may run during server-side rendering.
 */
import { StrKey } from '@stellar/stellar-sdk';

export const ADDRESS_BOOK_STORAGE_KEY = 'commitlabs:address-book';

export interface AddressEntry {
  id: string;
  address: string;
  label: string;
}

export type AddressBookPatch = Partial<Pick<AddressEntry, 'label' | 'address'>>;

function hasWindowStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Validate a single candidate entry. Returns the normalized entry if every
 * field is well-formed, or `null` if the candidate is unusable and should be
 * dropped.
 */
function validateAddressEntry(value: unknown): AddressEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (!isString(candidate.id) || candidate.id.length === 0) return null;
  if (!isString(candidate.address)) return null;
  if (!isString(candidate.label)) return null;

  const trimmedAddress = candidate.address.trim();
  if (!StrKey.isValidEd25519PublicKey(trimmedAddress)) return null;

  return {
    id: candidate.id,
    address: trimmedAddress,
    label: candidate.label,
  };
}

/**
 * Safely load the address book from `localStorage`. Returns `[]` if storage
 * is unavailable, the value is empty, parsing fails, or the value is not an
 * array. Individual malformed entries are skipped rather than aborting the
 * entire load.
 */
export function load(): AddressEntry[] {
  if (!hasWindowStorage()) return [];
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(ADDRESS_BOOK_STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const valid: AddressEntry[] = [];
  for (const candidate of parsed) {
    const entry = validateAddressEntry(candidate);
    if (entry) valid.push(entry);
  }
  return valid;
}

/** Persist the supplied entries to localStorage. Silently no-ops on the server. */
function persist(entries: AddressEntry[]): void {
  if (!hasWindowStorage()) return;
  try {
    window.localStorage.setItem(ADDRESS_BOOK_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage may be full or disabled (e.g. Safari private mode).
    // Swallow the error so address-book changes are best-effort.
  }
}

function generateId(): string {
  const cryptoApi =
    typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  // Fallback: time + entropy — collision risk is negligible for a personal
  // address book of well under a million entries.
  return `addr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function assertStellarAddress(address: unknown): string {
  if (typeof address !== 'string') {
    throw new TypeError('address must be a string Stellar public key (G... format).');
  }
  const trimmed = address.trim();
  if (!StrKey.isValidEd25519PublicKey(trimmed)) {
    throw new TypeError('address must be a valid Stellar StrKey public key (G... format).');
  }
  return trimmed;
}

function assertLabel(label: unknown): string {
  if (typeof label !== 'string') {
    throw new TypeError('label must be a string.');
  }
  return label;
}

/** Returns every persisted entry. Equivalent to {@link load}. */
export function getAll(): AddressEntry[] {
  return load();
}

/**
 * Add a new entry, or update the `label` of an existing entry that has the
 * same Stellar address. Throws `TypeError` if `address` is not a valid
 * Stellar public key or `label` is not a string.
 *
 * The same array reference is shared with persisted storage; the returned
 * entry is a *freshly added* object on new inserts, but on a duplicate-add
 * it is the same object reference found in {@link load}. Mutating the
 * returned entry will therefore mutate the persisted copy until the next
 * load (which rebuilds from JSON, producing a new object). If callers need
 * an isolated copy, they should clone the result: `{ ...entry }`.
 */
export function add(address: string, label: string): AddressEntry {
  const validatedAddress = assertStellarAddress(address);
  const validatedLabel = assertLabel(label);
  const entries = load();
  const existing = entries.find((entry) => entry.address === validatedAddress);
  if (existing) {
    existing.label = validatedLabel;
    persist(entries);
    return existing;
  }
  const entry: AddressEntry = {
    id: generateId(),
    address: validatedAddress,
    label: validatedLabel,
  };
  entries.push(entry);
  persist(entries);
  return entry;
}

/**
 * Patch the `label` and/or `address` of an existing entry, identified by
 * `id`. Returns the updated entry, or `null` if no entry with that id
 * exists. Throws `TypeError` when a new `address` is provided but is not a
 * valid Stellar public key.
 */
export function update(id: string, patch: AddressBookPatch): AddressEntry | null {
  if (typeof id !== 'string' || id.length === 0) {
    throw new TypeError('id must be a non-empty string.');
  }
  const entries = load();
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) return null;

  if (patch.address !== undefined) {
    entry.address = assertStellarAddress(patch.address);
  }
  if (patch.label !== undefined) {
    entry.label = assertLabel(patch.label);
  }
  persist(entries);
  return entry;
}

/**
 * Remove the entry with the supplied id. Returns `true` if an entry was
 * removed, `false` otherwise.
 */
export function remove(id: string): boolean {
  if (typeof id !== 'string') return false;
  const entries = load();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) return false;
  entries.splice(index, 1);
  persist(entries);
  return true;
}

/**
 * Returns the persisted label for an address, if any. Addresses are matched
 * after trimming; invalid Stellar addresses return `undefined`.
 */
export function labelFor(address: unknown): string | undefined {
  let validatedAddress: string;
  try {
    validatedAddress = assertStellarAddress(address);
  } catch {
    return undefined;
  }
  const match = load().find((entry) => entry.address === validatedAddress);
  return match?.label;
}

/** Clear every persisted entry. */
export function clear(): void {
  if (!hasWindowStorage()) return;
  try {
    window.localStorage.removeItem(ADDRESS_BOOK_STORAGE_KEY);
  } catch {
    // Ignore — see persist() note above.
  }
}

/**
 * Test-only helper — removes any persisted address-book entries from
 * `window.localStorage` so each test starts from a known empty state.
 * Storage itself is NOT disabled; the function only clears the entry
 * list stored under {@link ADDRESS_BOOK_STORAGE_KEY}.
 *
 * @internal
 */
export function __resetAddressBookForTests(): void {
  if (!hasWindowStorage()) return;
  try {
    window.localStorage.removeItem(ADDRESS_BOOK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
