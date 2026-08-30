/**
 * @module notificationStateMachine
 *
 * Deterministic, atomic state-machine for notification read/acknowledgement
 * transitions and per-wallet notification storage.
 *
 * State machine
 * ─────────────
 * A notification moves through the following states:
 *
 *   UNREAD ──► READ ──► ACKNOWLEDGED
 *                │
 *                └──► (terminal; no further transitions allowed)
 *
 * Invariants
 * ──────────
 * 1. UNREAD → READ is the only valid forward transition from UNREAD.
 * 2. READ → ACKNOWLEDGED is the only valid forward transition from READ.
 * 3. No backward transitions are permitted (read ≠ unread, ack ≠ unread/read).
 * 4. Replaying the *same* transition on a notification already in the target
 *    state is idempotent and returns the current record unchanged (safe retry).
 * 5. A cross-state replay (e.g. ACKNOWLEDGE on UNREAD) is rejected with
 *    INVALID_TRANSITION.
 * 6. Only the ownerAddress present in the notification may transition it.
 *
 * Idempotency
 * ───────────
 * Clients supply an `Idempotency-Key` header on write requests. The service
 * records completed transitions keyed by (idempotencyKey). On a retry with
 * the same key the stored response is returned verbatim. Stale-key TTL is 24h.
 *
 * Recovery
 * ────────
 * If a write (PATCH /acknowledge) is interrupted after the store write but
 * before the HTTP response is returned, a retry with the same Idempotency-Key
 * will find the COMPLETED record and return the previously committed result —
 * preventing a double-transition.
 */

import type { Notification } from '@/lib/types/domain';
import { IdempotencyService } from './idempotency';
import { ConflictError, NotFoundError, ForbiddenError } from './errors';

// ─── State machine types ──────────────────────────────────────────────────────

/** All observable states a notification may occupy. */
export type NotificationState = 'UNREAD' | 'READ' | 'ACKNOWLEDGED';

/** All mutation events the state machine accepts. */
export type NotificationEvent = 'MARK_READ' | 'ACKNOWLEDGE';

/**
 * Derived from `Notification.read` and the presence of `acknowledgedAt`.
 * We keep the canonical field layout of `Notification` and augment it with
 * `acknowledgedAt` and the computed `state` helper.
 */
export interface NotificationRecord extends Notification {
  /** ISO-8601 timestamp when the notification transitioned to ACKNOWLEDGED. */
  acknowledgedAt?: string;
  /** Current machine state, derived deterministically from `read` and `acknowledgedAt`. */
  state: NotificationState;
}

/**
 * Derive the machine state from the stored notification fields.
 * This is the *single source of truth* — `state` is never stored independently.
 */
export function deriveState(n: Omit<NotificationRecord, 'state'>): NotificationState {
  if (n.acknowledgedAt) return 'ACKNOWLEDGED';
  if (n.read) return 'READ';
  return 'UNREAD';
}

/** Transition table: given `current state` × `event` → `next state | null` */
const TRANSITION_TABLE: Record<
  NotificationState,
  Partial<Record<NotificationEvent, NotificationState>>
> = {
  UNREAD: { MARK_READ: 'READ' },
  READ: { ACKNOWLEDGE: 'ACKNOWLEDGED' },
  ACKNOWLEDGED: {},
};

export interface TransitionResult {
  notification: NotificationRecord;
  /** true when a state change occurred, false when the transition was a no-op replay */
  changed: boolean;
}

/**
 * Apply `event` to `notification` according to the state machine.
 *
 * @throws ConflictError on INVALID_TRANSITION (wrong event for current state)
 * @throws ConflictError on TERMINAL_STATE (notification is already ACKNOWLEDGED)
 */
export function applyTransition(
  notification: NotificationRecord,
  event: NotificationEvent,
  now = new Date().toISOString(),
): TransitionResult {
  const current = notification.state;

  // ACKNOWLEDGED is a terminal state — all further transitions are rejected.
  // This is NOT an idempotent replay; the notification cannot move backward.
  if (current === 'ACKNOWLEDGED') {
    throw new ConflictError(
      `Notification ${notification.id} is in terminal state ACKNOWLEDGED and cannot be transitioned.`,
    );
  }

  const targetState = TRANSITION_TABLE[current]?.[event];

  if (!targetState) {
    // Idempotent replay detection for non-terminal states:
    // UNREAD receiving mark_read when already READ is safe to return as-is.
    const isAlreadyRead = event === 'MARK_READ' && current === 'READ';

    if (isAlreadyRead) {
      return { notification, changed: false };
    }

    throw new ConflictError(
      `Invalid transition: event '${event}' is not valid from state '${current}'. ` +
        `Notification ${notification.id} is currently ${current}.`,
    );
  }

  // Apply transition
  const updated: NotificationRecord = { ...notification };

  if (event === 'MARK_READ') {
    updated.read = true;
  } else if (event === 'ACKNOWLEDGE') {
    updated.read = true;
    updated.acknowledgedAt = now;
  }

  updated.state = deriveState(updated);
  return { notification: updated, changed: true };
}

// ─── Notification Store ───────────────────────────────────────────────────────

export interface NotificationStore {
  /** List paginated notifications for a wallet. Filtered by preference categories. */
  list(
    ownerAddress: string,
    options: { page: number; pageSize: number; unreadOnly?: boolean },
  ): Promise<{ items: NotificationRecord[]; total: number }>;

  /** Return a single notification record, or null if not found. */
  get(id: string): Promise<NotificationRecord | null>;

  /** Atomically replace a notification record. */
  put(notification: NotificationRecord): Promise<void>;

  /** Insert a new notification. Throws ConflictError if id already exists. */
  insert(notification: Omit<NotificationRecord, 'state'>): Promise<NotificationRecord>;

  /** Upsert many notifications (for seeding / test convenience). */
  seed(notifications: Omit<NotificationRecord, 'state'>[]): Promise<void>;
}

/**
 * In-memory implementation – default for tests and memory-backed deployments.
 * Production deployments should swap in a KV/database-backed adapter
 * without changing route code.
 */
export class InMemoryNotificationStore implements NotificationStore {
  private _store = new Map<string, NotificationRecord>();

  // Expose for test inspection only
  get _data(): ReadonlyMap<string, NotificationRecord> {
    return this._store;
  }

  private hydrateState(raw: Omit<NotificationRecord, 'state'>): NotificationRecord {
    return { ...raw, state: deriveState(raw) };
  }

  async list(
    ownerAddress: string,
    options: { page: number; pageSize: number; unreadOnly?: boolean },
  ): Promise<{ items: NotificationRecord[]; total: number }> {
    let all = Array.from(this._store.values()).filter((n) => n.ownerAddress === ownerAddress);

    if (options.unreadOnly) {
      all = all.filter((n) => n.state === 'UNREAD');
    }

    // Sort newest-first
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = all.length;
    const start = (options.page - 1) * options.pageSize;
    const items = all.slice(start, start + options.pageSize);
    return { items, total };
  }

  async get(id: string): Promise<NotificationRecord | null> {
    return this._store.get(id) ?? null;
  }

  async put(notification: NotificationRecord): Promise<void> {
    this._store.set(notification.id, { ...notification, state: deriveState(notification) });
  }

  async insert(raw: Omit<NotificationRecord, 'state'>): Promise<NotificationRecord> {
    if (this._store.has(raw.id)) {
      throw new ConflictError(`Notification with id '${raw.id}' already exists.`);
    }
    const record = this.hydrateState(raw);
    this._store.set(record.id, record);
    return record;
  }

  async seed(notifications: Omit<NotificationRecord, 'state'>[]): Promise<void> {
    for (const n of notifications) {
      this._store.set(n.id, this.hydrateState(n));
    }
  }

  /** Test-only: clear all data */
  reset(): void {
    this._store.clear();
  }
}

// Singleton store (swappable in tests)
let _defaultStore: NotificationStore = new InMemoryNotificationStore();

export function getNotificationStore(): NotificationStore {
  return _defaultStore;
}

export function setNotificationStoreForTesting(store: NotificationStore): void {
  _defaultStore = store;
}

export function resetNotificationStore(): void {
  if (_defaultStore instanceof InMemoryNotificationStore) {
    (_defaultStore as InMemoryNotificationStore).reset();
  }
}

// ─── Idempotency service (re-used across routes) ──────────────────────────────

export const notificationIdempotency = new IdempotencyService(
  undefined, // uses globalStore from idempotency.ts
  86400, // 24-hour TTL
);

// ─── Authorization guard ──────────────────────────────────────────────────────

/**
 * Asserts that `callerAddress` is the owner of `notification`.
 * @throws ForbiddenError if ownership does not match.
 */
export function assertNotificationOwner(
  notification: NotificationRecord,
  callerAddress: string,
): void {
  if (notification.ownerAddress !== callerAddress) {
    throw new ForbiddenError(
      `You do not have permission to modify notification ${notification.id}.`,
    );
  }
}

// ─── Transition service (orchestrates guard + state machine + store) ──────────

export interface TransitionService {
  /**
   * Deterministically transition notification `id` via `event`.
   * Idempotent: replays with the same (id + idempotencyKey) return the
   * cached result without re-executing the transition.
   *
   * @throws NotFoundError   – notification not found
   * @throws ForbiddenError  – callerAddress ≠ ownerAddress
   * @throws ConflictError   – invalid or terminal-state transition
   */
  transition(
    id: string,
    event: NotificationEvent,
    callerAddress: string,
    idempotencyKey: string,
  ): Promise<{ notification: NotificationRecord; fromCache: boolean }>;
}

export class NotificationTransitionService implements TransitionService {
  constructor(
    private store: NotificationStore,
    private idempotency: IdempotencyService,
  ) {}

  async transition(
    id: string,
    event: NotificationEvent,
    callerAddress: string,
    idempotencyKey: string,
  ): Promise<{ notification: NotificationRecord; fromCache: boolean }> {
    // 1. Check idempotency cache first (before any storage reads)
    const cached = await this.idempotency.getRecord<NotificationRecord>(idempotencyKey);
    if (cached?.status === 'COMPLETED' && cached.response) {
      return { notification: cached.response, fromCache: true };
    }

    // 2. Load record
    const existing = await this.store.get(id);
    if (!existing) {
      throw new NotFoundError(`Notification '${id}'`);
    }

    // 3. Ownership check
    assertNotificationOwner(existing, callerAddress);

    // 4. Apply state machine transition
    const { notification: updated, changed } = applyTransition(existing, event);

    // 5. Persist only if something changed
    if (changed) {
      await this.store.put(updated);
    }

    // 6. Record idempotency result
    await this.idempotency.complete(idempotencyKey, updated, 200);

    return { notification: updated, fromCache: false };
  }
}
