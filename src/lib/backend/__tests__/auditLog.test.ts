import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  recordAuditEvent,
  getAuditLog,
  appendAuditEvent,
  getRecentAuditEvents,
  getAuditEventCount,
  isAuditLogEnabled,
  resetAuditStoreForTests,
  type AuditLogEntry,
  type AuditEventType,
  type AuditEventCategory,
  type AuditEventSeverity,
} from '../auditLog';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const REDACTED = '[REDACTED]';

describe('auditLog — recordAuditEvent and store', () => {
  beforeEach(() => {
    resetAuditStoreForTests();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── recordAuditEvent ────────────────────────────────────────────────────────

  describe('recordAuditEvent', () => {
    it('returns an entry with a UUID id', () => {
      const entry = recordAuditEvent({
        eventType: 'DISPUTE_OPENED',
        actorAddress: '0xActor1',
        commitmentId: 'cm-1',
        details: {},
      });
      expect(entry.id).toMatch(UUID_REGEX);
    });

    it('returns an entry with a valid ISO timestamp', () => {
      const before = Date.now();
      const entry = recordAuditEvent({
        eventType: 'DISPUTE_OPENED',
        actorAddress: '0xActor1',
        commitmentId: 'cm-1',
        details: {},
      });
      const after = Date.now();
      expect(entry.timestamp).toMatch(ISO_TIMESTAMP_REGEX);
      const ts = Date.parse(entry.timestamp);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('preserves all supplied fields in the returned entry', () => {
      const input = {
        eventType: 'DISPUTE_RESOLVED' as AuditEventType,
        actorAddress: '0xActor2',
        commitmentId: 'cm-2',
        details: { reason: 'evidence provided', amount: 100 },
      };
      const entry = recordAuditEvent(input);
      expect(entry).toMatchObject(input);
    });

    it('stores the entry so it is retrievable via getAuditLog', () => {
      const entry = recordAuditEvent({
        eventType: 'DISPUTE_OPENED',
        actorAddress: '0xActor1',
        commitmentId: 'cm-3',
        details: {},
      });
      const logs = getAuditLog({ commitmentId: 'cm-3' });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(entry);
    });

    it('assigns unique IDs to successive events', () => {
      const a = recordAuditEvent({ eventType: 'DISPUTE_OPENED', actorAddress: '0xA', commitmentId: 'cm-x', details: {} });
      const b = recordAuditEvent({ eventType: 'DISPUTE_OPENED', actorAddress: '0xA', commitmentId: 'cm-x', details: {} });
      expect(a.id).not.toBe(b.id);
    });

    it('emits a structured JSON log to console', () => {
      const spy = vi.spyOn(console, 'log');
      const entry = recordAuditEvent({
        eventType: 'DISPUTE_RESOLVED_FAILED',
        actorAddress: '0xActor3',
        commitmentId: 'cm-4',
        details: { error: 'timeout' },
      });
      expect(spy).toHaveBeenCalledOnce();
      const logged = JSON.parse(spy.mock.calls[0][0] as string);
      expect(logged).toEqual({ event: 'AuditLog', ...entry });
    });
  });

  // ── getAuditLog filtering ───────────────────────────────────────────────────

  describe('getAuditLog — filtering and ordering', () => {
    const seed: Omit<AuditLogEntry, 'id' | 'timestamp'>[] = [
      { eventType: 'DISPUTE_OPENED', actorAddress: '0xAlice', commitmentId: 'cm-A', details: {} },
      { eventType: 'DISPUTE_RESOLVED', actorAddress: '0xBob', commitmentId: 'cm-A', details: {} },
      { eventType: 'DISPUTE_OPEN_FAILED', actorAddress: '0xAlice', commitmentId: 'cm-B', details: {} },
      { eventType: 'DISPUTE_RESOLVED_FAILED', actorAddress: '0xCarol', commitmentId: 'cm-B', details: {} },
    ];

    beforeEach(() => {
      seed.forEach(recordAuditEvent);
    });

    it('returns an empty array for an empty store', () => {
      resetAuditStoreForTests();
      expect(getAuditLog({})).toHaveLength(0);
    });

    it('returns all entries when no filter is specified', () => {
      expect(getAuditLog({})).toHaveLength(4);
    });

    it('filters by commitmentId', () => {
      const results = getAuditLog({ commitmentId: 'cm-A' });
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.commitmentId === 'cm-A')).toBe(true);
    });

    it('filters by actorAddress', () => {
      const results = getAuditLog({ actorAddress: '0xAlice' });
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.actorAddress === '0xAlice')).toBe(true);
    });

    it('filters by eventType', () => {
      const results = getAuditLog({ eventType: 'DISPUTE_RESOLVED' });
      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('DISPUTE_RESOLVED');
    });

    it('combines commitmentId and eventType filters', () => {
      const results = getAuditLog({ commitmentId: 'cm-A', eventType: 'DISPUTE_OPENED' });
      expect(results).toHaveLength(1);
      expect(results[0].actorAddress).toBe('0xAlice');
    });

    it('returns stable insertion order', () => {
      const all = getAuditLog({});
      const eventTypes = all.map((e) => e.eventType);
      expect(eventTypes).toEqual([
        'DISPUTE_OPENED',
        'DISPUTE_RESOLVED',
        'DISPUTE_OPEN_FAILED',
        'DISPUTE_RESOLVED_FAILED',
      ]);
    });
  });

  // ── appendAuditEvent / getRecentAuditEvents (AuditEvent store) ─────────────

  describe('appendAuditEvent and getRecentAuditEvents', () => {
    const originalEnv = process.env.COMMITLABS_FEATURE_AUDIT_LOG;

    beforeEach(() => {
      process.env.COMMITLABS_FEATURE_AUDIT_LOG = 'true';
      resetAuditStoreForTests();
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.COMMITLABS_FEATURE_AUDIT_LOG;
      } else {
        process.env.COMMITLABS_FEATURE_AUDIT_LOG = originalEnv;
      }
    });

    it('isAuditLogEnabled returns true when env var is "true"', () => {
      expect(isAuditLogEnabled()).toBe(true);
    });

    it('isAuditLogEnabled returns false when env var is absent', () => {
      delete process.env.COMMITLABS_FEATURE_AUDIT_LOG;
      expect(isAuditLogEnabled()).toBe(false);
    });

    it('appendAuditEvent stores a well-formed event', async () => {
      await appendAuditEvent({
        category: 'commitment' as AuditEventCategory,
        action: 'created',
        severity: 'info' as AuditEventSeverity,
        actor: '0xActor',
        resourceId: 'res-1',
      });
      const events = await getRecentAuditEvents(10);
      expect(events).toHaveLength(1);
      expect(events[0].id).toMatch(UUID_REGEX);
      expect(events[0].timestamp).toMatch(ISO_TIMESTAMP_REGEX);
      expect(events[0].category).toBe('commitment');
      expect(events[0].action).toBe('created');
    });

    it('redacts sensitive fields (actor, ip) in retrieved events', async () => {
      await appendAuditEvent({
        category: 'auth' as AuditEventCategory,
        action: 'login',
        severity: 'info' as AuditEventSeverity,
        actor: '0xSensitiveActor',
        ip: '192.168.1.1',
      });
      const events = await getRecentAuditEvents(10);
      expect(events[0].actor).toBe(REDACTED);
      expect(events[0].ip).toBe(REDACTED);
    });

    it('getRecentAuditEvents returns events in reverse chronological order', async () => {
      await appendAuditEvent({ category: 'commitment', action: 'first', severity: 'info' });
      await appendAuditEvent({ category: 'commitment', action: 'second', severity: 'info' });
      await appendAuditEvent({ category: 'commitment', action: 'third', severity: 'info' });
      const events = await getRecentAuditEvents(10);
      expect(events[0].action).toBe('third');
      expect(events[1].action).toBe('second');
      expect(events[2].action).toBe('first');
    });

    it('getRecentAuditEvents respects the limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await appendAuditEvent({ category: 'admin', action: `action-${i}`, severity: 'info' });
      }
      const events = await getRecentAuditEvents(3);
      expect(events).toHaveLength(3);
    });

    it('getRecentAuditEvents filters by actor', async () => {
      await appendAuditEvent({ category: 'auth', action: 'login', severity: 'info', actor: '0xAlice' });
      await appendAuditEvent({ category: 'auth', action: 'login', severity: 'info', actor: '0xBob' });
      const events = await getRecentAuditEvents(10, { actor: '0xAlice' });
      expect(events).toHaveLength(1);
    });

    it('getRecentAuditEvents filters by action type', async () => {
      await appendAuditEvent({ category: 'marketplace', action: 'listed', severity: 'info' });
      await appendAuditEvent({ category: 'marketplace', action: 'purchased', severity: 'info' });
      const events = await getRecentAuditEvents(10, { type: 'listed' });
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('listed');
    });

    it('getRecentAuditEvents returns empty array when feature flag is disabled', async () => {
      delete process.env.COMMITLABS_FEATURE_AUDIT_LOG;
      await appendAuditEvent({ category: 'commitment', action: 'created', severity: 'info' });
      const events = await getRecentAuditEvents(10);
      expect(events).toHaveLength(0);
    });

    it('getAuditEventCount returns 0 for an empty store', async () => {
      expect(await getAuditEventCount()).toBe(0);
    });

    it('getAuditEventCount returns the total number of stored events', async () => {
      await appendAuditEvent({ category: 'commitment', action: 'a', severity: 'info' });
      await appendAuditEvent({ category: 'commitment', action: 'b', severity: 'info' });
      expect(await getAuditEventCount()).toBe(2);
    });

    it('appendAuditEvent is a no-op when feature flag is disabled', async () => {
      delete process.env.COMMITLABS_FEATURE_AUDIT_LOG;
      await appendAuditEvent({ category: 'commitment', action: 'created', severity: 'info' });
      process.env.COMMITLABS_FEATURE_AUDIT_LOG = 'true';
      expect(await getAuditEventCount()).toBe(0);
    });
  });
});
