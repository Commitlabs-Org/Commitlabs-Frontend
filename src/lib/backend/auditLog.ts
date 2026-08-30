/**
 * Minimal audit-event recorder.
 *
 * Emits a structured, redacted JSON line for security-relevant events
 * (e.g. dispute opened / resolved). Keeping this module intentionally light:
 * the actual sink can be swapped for a durable audit store later without
 * changing call sites.
 *
 * @see logger.ts for the underlying emit mechanism
 */
import { randomUUID } from 'crypto';
import { redact } from './redact';

export interface AuditEventData {
  /** Discriminator describing the auditable action. */
  eventType: string;
  /** Wallet address performing the action (or '' when anonymous). */
  actorAddress?: string;
  /** Aggregate the event belongs to, when applicable. */
  commitmentId?: string;
  /** Free-form, non-sensitive details. */
  details?: Record<string, unknown>;
}

export interface AuditLogOptions {
  requestId?: string;
}

/**
 * Record a security-relevant audit event.
 *
 * Currently writes a redacted, timestamped JSON line to the console so the
 * hook is observable in tests and dev. It intentionally returns `void` and
 * never throws so audit failures cannot break a request.
 */
export function recordAuditEvent(data: AuditEventData, options: AuditLogOptions = {}): void {
  const entry = {
    event: 'audit',
    eventType: data.eventType,
    timestamp: new Date().toISOString(),
    requestId: options.requestId ?? randomUUID(),
    actorAddress: data.actorAddress,
    commitmentId: data.commitmentId,
    details: data.details,
  };
  // Redact sensitive fields before emitting.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(redact(entry)));
}

/** Shorthand to surface a warning-level audit line (e.g. unauthorized access). */
export function warn(message: string, context: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(redact({ event: 'audit.warn', message, context })));
}

/** Shorthand to surface an error-level audit line. */
export function error(message: string, context: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(redact({ event: 'audit.error', message, context })));
}

export const auditLog = { recordAuditEvent, warn, error };
