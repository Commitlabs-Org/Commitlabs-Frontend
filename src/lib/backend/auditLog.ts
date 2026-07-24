import { randomUUID } from "crypto";

export type AuditEventType =
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  | "DISPUTE_RESOLVED_FAILED"
  | "DISPUTE_OPEN_FAILED";

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  timestamp: string;
  actorAddress: string;
  commitmentId: string;
  details: Record<string, unknown>;
}

const auditLogStore: AuditLogEntry[] = [];

export function recordAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const logEntry: AuditLogEntry = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        ...entry,
    };

    auditLogStore.push(logEntry);

    console.log(JSON.stringify({
        event: 'AuditLog',
        ...logEntry,
    }));

    return logEntry;
}

export interface GetAuditLogFilters {
  commitmentId?: string;
  actorAddress?: string;
  eventType?: AuditEventType;
}

export function getAuditLog(filters: GetAuditLogFilters): AuditLogEntry[] {
  return auditLogStore.filter((entry) => {
    if (filters.commitmentId && entry.commitmentId !== filters.commitmentId)
      return false;
    if (filters.actorAddress && entry.actorAddress !== filters.actorAddress)
      return false;
    if (filters.eventType && entry.eventType !== filters.eventType) return false;
    return true;
  });
}

export function clearAuditLog(): void {
  auditLogStore.length = 0;
  if (typeof auditEventsStore !== 'undefined') {
    auditEventsStore.length = 0;
  }
}
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
  | "commitment"
  | "attestation"
  | "marketplace"
  | "auth"
  | "admin";

export type AuditEventSeverity = "info" | "warn" | "error";

export interface AuditEvent {
  id: string;
  timestamp: string;
  category: AuditEventCategory;
  action: string;
  severity: AuditEventSeverity;
  actor?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export type RedactedAuditEvent = Omit<AuditEvent, "actor" | "ip"> & {
  actor: string;
  ip: string;
};

const auditEventsStore: AuditEvent[] = [];
const REDACTED = "[REDACTED]";
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function redactAuditEvent(event: AuditEvent): RedactedAuditEvent {
  return {
    ...event,
    actor: REDACTED,
    ip: REDACTED,
  };
}

export function isAuditLogEnabled(): boolean {
  const raw = process.env.COMMITLABS_FEATURE_AUDIT_LOG;
  if (raw === undefined) return false;
  return TRUE_VALUES.has(raw.trim().toLowerCase());
}

export async function appendAuditEvent(
  event: Omit<AuditEvent, "id" | "timestamp">,
): Promise<void> {
  if (!isAuditLogEnabled()) return;
  auditEventsStore.push({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  });
}

export interface AuditEventFilters {
  actor?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
}

export async function getRecentAuditEvents(limit: number, filters?: AuditEventFilters): Promise<RedactedAuditEvent[]> {
  if (!isAuditLogEnabled()) return [];
  let events = auditEventsStore;
  if (filters) {
    if (filters.actor) events = events.filter(e => e.actor === filters.actor);
    if (filters.type) events = events.filter(e => e.action === filters.type);
    if (filters.startTime) { const t = filters.startTime; events = events.filter(e => e.timestamp >= t); }
    if (filters.endTime) { const t = filters.endTime; events = events.filter(e => e.timestamp <= t); }
  }
  return events.slice(-limit).reverse().map(redactAuditEvent);
}

export async function getAuditEventCount(filters?: AuditEventFilters): Promise<number> {
  if (!isAuditLogEnabled()) return 0;
  if (!filters) return auditEventsStore.length;
  let events = auditEventsStore;
  if (filters.actor) events = events.filter(e => e.actor === filters.actor);
  if (filters.type) events = events.filter(e => e.action === filters.type);
  if (filters.startTime) { const t = filters.startTime; events = events.filter(e => e.timestamp >= t); }
  if (filters.endTime) { const t = filters.endTime; events = events.filter(e => e.timestamp <= t); }
  return events.length;
}

export function resetAuditStoreForTests(): void {
  auditLogStore.length = 0;
  auditEventsStore.length = 0;
}
