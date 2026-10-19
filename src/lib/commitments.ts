import { isStorageAvailable, readRaw, removeRaw, subscribeStorage, writeRaw } from './storage';

export type CommitmentType = 'safe' | 'balanced' | 'aggressive';
export type CommitmentStatus = 'active' | 'matured' | 'settled' | 'exited';

export interface TypeSpec {
  id: CommitmentType;
  name: string;
  tagline: string;
  apy: number; // target APY in percent
  maxLoss: number; // max loss % the commitment tolerates
  penalty: number; // early exit penalty %
  minDays: number;
}

export const TYPES: TypeSpec[] = [
  {
    id: 'safe',
    name: 'Safe',
    tagline: 'Capital preservation with tight loss limits.',
    apy: 4.5,
    maxLoss: 2,
    penalty: 3,
    minDays: 7,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    tagline: 'Moderate yield with moderate drawdown tolerance.',
    apy: 9,
    maxLoss: 8,
    penalty: 5,
    minDays: 14,
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    tagline: 'Maximum yield, wide loss tolerance, longer lock.',
    apy: 16,
    maxLoss: 20,
    penalty: 8,
    minDays: 30,
  },
];

export interface Commitment {
  id: string;
  type: CommitmentType;
  asset: string;
  amount: number;
  durationDays: number;
  maxLoss: number;
  penalty: number;
  apy: number;
  createdAt: number; // ms epoch
  status: CommitmentStatus;
  owner: string | null;
  txHash: string | null;
  /** Present and true for sample records loaded from the empty state. */
  demo?: boolean;
}

/** Result of reading persisted commitments; never throws. */
export interface LoadResult {
  items: Commitment[];
  /** Number of records that were present but failed validation. */
  dropped: number;
  /** True when the stored payload could not be understood at all. */
  corrupt: boolean;
  /** True when `localStorage` is unusable, so items only live in memory. */
  storageUnavailable: boolean;
}

const KEY = 'commitlabs.commitments.v1';
const DAY = 86_400_000;
const CURRENT_VERSION = 2;

/** Sane upper bounds so hostile or accidentally huge strings are rejected. */
const MAX_ID = 128;
const MAX_ASSET = 32;
const MAX_OWNER = 256;
const MAX_TX_HASH = 128;

const TYPE_IDS = new Set<string>(TYPES.map((t) => t.id));
const STATUS_IDS = new Set<CommitmentStatus>(['active', 'matured', 'settled', 'exited']);

export function specFor(type: CommitmentType): TypeSpec {
  return TYPES.find((t) => t.id === type) ?? TYPES[1]!;
}

export function maturityOf(c: Commitment): number {
  return c.createdAt + c.durationDays * DAY;
}

export function effectiveStatus(c: Commitment, now = Date.now()): CommitmentStatus {
  if (c.status === 'active' && now >= maturityOf(c)) return 'matured';
  return c.status;
}

export function progressOf(c: Commitment, now = Date.now()): number {
  const total = c.durationDays * DAY;
  return Math.max(0, Math.min(1, (now - c.createdAt) / total));
}

export function projectedYield(c: Commitment): number {
  return (c.amount * (c.apy / 100) * c.durationDays) / 365;
}

let fallbackCounter = 0;

/** In-memory store used only when `localStorage` writes fail (private mode, quota). */
let memoryStore: Commitment[] | null = null;

/**
 * Generates a collision-resistant id. Uses `crypto.randomUUID()` when
 * available, otherwise 64 random bits from `crypto.getRandomValues`. Only
 * falls back to a timestamp/counter when the Crypto API is missing entirely.
 */
export function newId(): string {
  const crypto = globalThis.crypto;
  if (crypto && typeof crypto.randomUUID === 'function') {
    return `CMT-${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  }
  if (crypto && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return `CMT-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }
  fallbackCounter += 1;
  return `CMT-${(Date.now().toString(16) + fallbackCounter.toString(16)).toUpperCase()}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/**
 * Validates a single untrusted value into a `Commitment`, returning null when
 * it cannot be trusted. Numeric fields must be finite and non-negative; string
 * fields must be present and within sane length limits.
 */
export function validateCommitment(value: unknown): Commitment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;

  if (!isBoundedString(o.id, MAX_ID)) return null;
  if (typeof o.type !== 'string' || !TYPE_IDS.has(o.type)) return null;
  if (!isBoundedString(o.asset, MAX_ASSET)) return null;
  if (!isFiniteNumber(o.amount) || o.amount < 0) return null;
  if (!isFiniteNumber(o.durationDays) || o.durationDays <= 0) return null;
  if (!isFiniteNumber(o.maxLoss) || o.maxLoss < 0) return null;
  if (!isFiniteNumber(o.penalty) || o.penalty < 0) return null;
  if (!isFiniteNumber(o.apy) || o.apy < 0) return null;
  if (!isFiniteNumber(o.createdAt) || o.createdAt < 0) return null;
  if (typeof o.status !== 'string' || !STATUS_IDS.has(o.status as CommitmentStatus)) return null;
  if (o.owner !== null && o.owner !== undefined && !isBoundedString(o.owner, MAX_OWNER)) return null;
  if (o.txHash !== null && o.txHash !== undefined && !isBoundedString(o.txHash, MAX_TX_HASH)) {
    return null;
  }

  return {
    id: o.id,
    type: o.type as CommitmentType,
    asset: o.asset,
    amount: o.amount,
    durationDays: o.durationDays,
    maxLoss: o.maxLoss,
    penalty: o.penalty,
    apy: o.apy,
    createdAt: o.createdAt,
    status: o.status as CommitmentStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    txHash: typeof o.txHash === 'string' ? o.txHash : null,
    ...(o.demo === true ? { demo: true } : {}),
  };
}

/**
 * Migration pipeline. Each step receives the output of the previous step (the
 * raw parsed JSON for the first step) and returns the next shape. To support a
 * future schema version, append a step; never remove or reorder existing ones.
 *
 * Step 1: v1 (bare `Commitment[]`) -> v2 (`{ version: 2, items: [...] }`).
 */
const MIGRATIONS: ReadonlyArray<(value: unknown) => unknown> = [
  (value) => (Array.isArray(value) ? { version: 2, items: value } : value),
];

/** Runs the migration pipeline over a raw parsed value. */
export function migrate(raw: unknown): unknown {
  return MIGRATIONS.reduce((value, step) => step(value), raw);
}

function envelopeItems(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const items = (value as { items?: unknown }).items;
    if (Array.isArray(items)) return items;
  }
  return null;
}

function isCanonical(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { version?: unknown }).version === CURRENT_VERSION
  );
}

/**
 * Reads commitments from storage without ever throwing.
 *
 * Valid records are returned in `items`; invalid ones are dropped and counted.
 * A completely unreadable payload is reported via `corrupt`. When storage is
 * unavailable the returned items come from an in-memory session store.
 */
export function loadCommitments(): LoadResult {
  if (memoryStore) {
    return { items: memoryStore, dropped: 0, corrupt: false, storageUnavailable: true };
  }

  if (!isStorageAvailable()) {
    return { items: [], dropped: 0, corrupt: false, storageUnavailable: true };
  }

  const raw = readRaw(KEY);
  if (raw === null) {
    return { items: [], dropped: 0, corrupt: false, storageUnavailable: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { items: [], dropped: 0, corrupt: true, storageUnavailable: false };
  }

  const items = envelopeItems(migrate(parsed));
  if (!items) {
    return { items: [], dropped: 0, corrupt: true, storageUnavailable: false };
  }

  let dropped = 0;
  const valid: Commitment[] = [];
  for (const candidate of items) {
    const commitment = validateCommitment(candidate);
    if (commitment) valid.push(commitment);
    else dropped += 1;
  }

  // Persist the migrated/cleaned payload so future reads are cheap and v1 data
  // is upgraded in place without loss.
  let storageUnavailable = false;
  if (!isCanonical(parsed) || dropped > 0) {
    storageUnavailable = !saveCommitments(valid);
  }

  return { items: valid, dropped, corrupt: false, storageUnavailable };
}

/**
 * Persists commitments. Returns false when they could not be written; in that
 * case they are retained in memory for the rest of the session.
 */
export function saveCommitments(list: Commitment[]): boolean {
  const ok = writeRaw(KEY, JSON.stringify({ version: CURRENT_VERSION, items: list }));
  memoryStore = ok ? null : list;
  return ok;
}

/** Clears persisted commitments and any in-memory fallback. */
export function resetCommitments(): void {
  memoryStore = null;
  removeRaw(KEY);
}

/** Subscribes to cross-tab changes of the commitments key. */
export function subscribeCommitments(handler: () => void): () => void {
  return subscribeStorage(KEY, handler);
}

/**
 * Opt-in sample records for the dashboard empty state. They are flagged with
 * `demo: true` so the UI can label them honestly.
 */
export function sampleCommitments(): Commitment[] {
  const now = Date.now();
  return [
    {
      id: newId(),
      type: 'balanced',
      asset: 'USDC',
      amount: 2500,
      durationDays: 30,
      maxLoss: 8,
      penalty: 5,
      apy: 9,
      createdAt: now - 12 * DAY,
      status: 'active',
      owner: null,
      txHash: null,
      demo: true,
    },
    {
      id: newId(),
      type: 'safe',
      asset: 'XLM',
      amount: 10000,
      durationDays: 14,
      maxLoss: 2,
      penalty: 3,
      apy: 4.5,
      createdAt: now - 20 * DAY,
      status: 'active',
      owner: null,
      txHash: null,
      demo: true,
    },
  ];
}

export function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}
