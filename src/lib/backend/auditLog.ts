/**
 * Audit Event Store
 *
 * Provides a typed schema for audit events and a pluggable store interface.
 *
 * Storage strategy:
 *   - Development / test: in-memory ring buffer (last MAX_BUFFER_SIZE events).
 *   - Production: swap `activeStore` for a durable backend (Postgres, Redis Streams,
 *     Datadog Logs, etc.) by implementing the `AuditStore` interface.
 *
 * Sensitive fields (ownerAddress, verifiedBy, callerAddress, ip) are redacted
 * before events leave this module so that callers never need to remember to do it.
 *
 * Feature flag: COMMITLABS_FEATURE_AUDIT_LOG (env var, default off).
 * When disabled, `appendAuditEvent` is a no-op and `getRecentAuditEvents` returns [].
 */

// ─── Schema ───────────────────────────────────────────────────────────────────

export type AuditEventCategory =
  | 'commitment'
  | 'attestation'
  | 'marketplace'
  | 'auth'
  | 'admin';

export type AuditEventSeverity = 'info' | 'warn' | 'error';

/**
 * Raw audit event as recorded internally.
 * Sensitive fields are present here but redacted before external exposure.
 */
export interface AuditEvent {
  /** Unique event identifier (UUID v4). */
  id: string;
  /** ISO-8601 timestamp of when the event occurred. */
  timestamp: string;
  /** Broad category for filtering. */
  category: AuditEventCategory;
  /** Machine-readable action name, e.g. "commitment.created". */
  action: string;
  /** Severity level. */
  severity: AuditEventSeverity;
  /** Actor that triggered the event (wallet address, service account, etc.). */
  actor?: string;
  /** Resource identifier the action was performed on. */
  resourceId?: string;
  /** Arbitrary extra context — must NOT contain secrets. */
  metadata?: Record<string, unknown>;
  /** Requester IP — redacted before external exposure. */
  ip?: string;
}

/**
 * Redacted view of an audit event safe to return from the API.
 * Sensitive fields are replaced with a placeholder string.
 */
export type RedactedAuditEvent = Omit<AuditEvent, 'actor' | 'ip'> & {
  actor: string;
  ip: string;
};

// ─── Sensitive field redaction ────────────────────────────────────────────────

const REDACTED = '[REDACTED]';

/**
 * Returns a copy of the event with sensitive fields replaced by [REDACTED].
 * Metadata keys listed in SENSITIVE_METADATA_KEYS are also scrubbed.
 */
const SENSITIVE_METADATA_KEYS = new Set([
  'ownerAddress',
  'verifiedBy',
  'callerAddress',
  'sellerAddress',
  'privateKey',
  'secret',
  'token',
  'password',
]);

export function redactAuditEvent(event: AuditEvent): RedactedAuditEvent {
  const redactedMetadata: Record<string, unknown> | undefined = event.metadata
    ? Object.fromEntries(
        Object.entries(event.metadata).map(([k, v]) =>
          SENSITIVE_METADATA_KEYS.has(k) ? [k, REDACTED] : [k, v]
        )
      )
    : undefined;

  return {
    ...event,
    actor: event.actor ? REDACTED : REDACTED,
    ip: event.ip ? REDACTED : REDACTED,
    ...(redactedMetadata !== undefined ? { metadata: redactedMetadata } : {}),
  };
}

// ─── Store interface ──────────────────────────────────────────────────────────

export interface AuditStore {
  append(event: AuditEvent): void | Promise<void>;
  /** Returns events newest-first, up to `limit`. */
  recent(limit: number): AuditEvent[] | Promise<AuditEvent[]>;
  /** Total number of events in the store. */
  size(): number | Promise<number>;
}

// ─── In-memory store (dev / test) ─────────────────────────────────────────────

const MAX_BUFFER_SIZE = 500;

class InMemoryAuditStore implements AuditStore {
  private readonly buffer: AuditEvent[] = [];

  append(event: AuditEvent): void {
    this.buffer.push(event);
    // Evict oldest when buffer is full
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  recent(limit: number): AuditEvent[] {
    return this.buffer.slice(-limit).reverse();
  }

  size(): number {
    return this.buffer.length;
  }

  /** Test helper — clears all events. */
  clear(): void {
    this.buffer.length = 0;
  }
}

// Singleton in-memory store — replaced in production via setAuditStore().
const inMemoryStore = new InMemoryAuditStore();
let activeStore: AuditStore = inMemoryStore;

/**
 * Replace the active store with a durable implementation.
 * Call this once at application startup in production.
 *
 * @example
 * ```ts
 * import { setAuditStore } from '@/lib/backend/auditLog';
 * import { PostgresAuditStore } from '@/lib/backend/stores/postgresAuditStore';
 *
 * setAuditStore(new PostgresAuditStore(pool));
 * ```
 */
export function setAuditStore(store: AuditStore): void {
  activeStore = store;
}

/** Exposed for tests only — resets to the in-memory store and clears it. */
export function resetAuditStoreForTests(): void {
  inMemoryStore.clear();
  activeStore = inMemoryStore;
}

// ─── Feature flag ─────────────────────────────────────────────────────────────

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isAuditLogEnabled(): boolean {
  const raw = process.env.COMMITLABS_FEATURE_AUDIT_LOG;
  if (raw === undefined) return false;
  return TRUE_VALUES.has(raw.trim().toLowerCase());
}

// ─── ID generation ────────────────────────────────────────────────────────────

function generateId(): string {
  // Use crypto.randomUUID when available (Node 14.17+), fall back to a simple
  // timestamp+random string for environments that don't have it.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record an audit event.
 * No-op when the audit log feature flag is disabled.
 */
export async function appendAuditEvent(
  event: Omit<AuditEvent, 'id' | 'timestamp'>
): Promise<void> {
  if (!isAuditLogEnabled()) return;

  const full: AuditEvent = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...event,
  };

  await activeStore.append(full);
}

/**
 * Retrieve the most recent audit events, redacted for external consumption.
 * Returns an empty array when the feature flag is disabled.
 *
 * @param limit - Maximum number of events to return (1–200).
 */
export async function getRecentAuditEvents(
  limit: number
): Promise<RedactedAuditEvent[]> {
  if (!isAuditLogEnabled()) return [];

  const events = await activeStore.recent(limit);
  return events.map(redactAuditEvent);
}

/**
 * Returns the total number of events currently in the store.
 * Returns 0 when the feature flag is disabled.
 */
export async function getAuditEventCount(): Promise<number> {
  if (!isAuditLogEnabled()) return 0;
  return activeStore.size();
}
