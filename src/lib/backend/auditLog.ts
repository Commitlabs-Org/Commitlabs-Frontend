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

const auditLogStore: AuditLogEntry[] = [];
const auditEventsStore: AuditEvent[] = [];
const REDACTED = "[REDACTED]";
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function recordAuditEvent(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
  const logEntry: AuditLogEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };

  auditLogStore.push(logEntry);
  return logEntry;
}

function redactAuditEvent(event: AuditEvent): RedactedAuditEvent {
  return {
    ...event,
    actor: REDACTED,
    ip: REDACTED,
  };
}

export function getAuditLog(commitmentId: string): AuditLogEntry[] {
  return auditLogStore.filter((entry) => entry.commitmentId === commitmentId);
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

export async function getRecentAuditEvents(limit: number): Promise<RedactedAuditEvent[]> {
  if (!isAuditLogEnabled()) return [];
  return auditEventsStore.slice(-limit).reverse().map(redactAuditEvent);
}

export async function getAuditEventCount(): Promise<number> {
  if (!isAuditLogEnabled()) return 0;
  return auditEventsStore.length;
}

export function resetAuditStoreForTests(): void {
  auditLogStore.length = 0;
  auditEventsStore.length = 0;
}

export function clearAuditLog(): void {
  auditLogStore.length = 0;
  auditEventsStore.length = 0;
}
