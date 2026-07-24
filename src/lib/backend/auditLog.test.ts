import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordAuditEvent,
  getAuditLog,
  resetAuditStoreForTests,
  type AuditLogEntry,
  type AuditEventType,
} from './auditLog';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

describe('auditLog', () => {
  beforeEach(() => {
    resetAuditStoreForTests();
  });

  describe('recordAuditEvent', () => {
    it('returns an entry with a UUID id and ISO timestamp', () => {
      const entry = recordAuditEvent({
        eventType: 'DISPUTE_OPENED',
        actorAddress: 'actor1',
        commitmentId: 'cm1',
        details: {},
      });

      expect(entry.id).toMatch(UUID_REGEX);
      expect(entry.timestamp).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it('preserves the supplied fields in the returned entry', () => {
      const input = {
        eventType: 'DISPUTE_OPENED' as AuditEventType,
        actorAddress: 'actor1',
        commitmentId: 'cm1',
        details: { reason: 'test' },
      };

      const entry = recordAuditEvent(input);

      expect(entry).toMatchObject(input);
    });

    it('stores the entry, which is retrievable via getAuditLog', () => {
      const entry = recordAuditEvent({
        eventType: 'DISPUTE_OPENED',
        actorAddress: 'actor1',
        commitmentId: 'cm1',
        details: {},
      });

      const logs = getAuditLog({ commitmentId: 'cm1' });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(entry);
    });

    it('logs the event to the console as JSON', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const entry = recordAuditEvent({
        eventType: 'DISPUTE_OPENED',
        actorAddress: 'actor1',
        commitmentId: 'cm1',
        details: {},
      });

      expect(consoleSpy).toHaveBeenCalledOnce();
      const logObject = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logObject).toEqual({
        event: 'AuditLog',
        ...entry,
      });

      consoleSpy.mockRestore();
    });
  });

  describe('getAuditLog', () => {
    const entries: Omit<AuditLogEntry, 'id' | 'timestamp'>[] = [
      {
        eventType: 'DISPUTE_OPENED',
        actorAddress: 'actor1',
        commitmentId: 'cm1',
        details: {},
      },
      {
        eventType: 'DISPUTE_RESOLVED',
        actorAddress: 'actor2',
        commitmentId: 'cm1',
        details: {},
      },
      {
        eventType: 'DISPUTE_OPEN_FAILED',
        actorAddress: 'actor1',
        commitmentId: 'cm2',
        details: {},
      },
      {
        eventType: 'DISPUTE_RESOLVED_FAILED',
        actorAddress: 'actor3',
        commitmentId: 'cm2',
        details: {},
      },
    ];

    beforeEach(() => {
      entries.forEach(recordAuditEvent);
    });

    it('filters by commitmentId', () => {
      const logs = getAuditLog({ commitmentId: 'cm1' });
      expect(logs).toHaveLength(2);
      expect(logs.every((log) => log.commitmentId === 'cm1')).toBe(true);
    });

    it('filters by actorAddress', () => {
      const logs = getAuditLog({ actorAddress: 'actor1' });
      expect(logs).toHaveLength(2);
      expect(logs.every((log) => log.actorAddress === 'actor1')).toBe(true);
    });

    it('filters by eventType', () => {
      const logs = getAuditLog({ eventType: 'DISPUTE_OPENED' });
      expect(logs).toHaveLength(1);
      expect(logs[0].eventType).toBe('DISPUTE_OPENED');
    });

    it('combines multiple filters', () => {
      const logs = getAuditLog({ commitmentId: 'cm1', eventType: 'DISPUTE_OPENED' });
      expect(logs).toHaveLength(1);
      expect(logs[0].commitmentId).toBe('cm1');
      expect(logs[0].eventType).toBe('DISPUTE_OPENED');
    });
  });
});