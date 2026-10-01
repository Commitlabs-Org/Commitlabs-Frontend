import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  __resetSessionStoreForTests,
  createBrowserSession,
  readSessionIdFromRequest,
  getSessionBackend,
  getSessionRecord,
  rotateCsrfToken,
  deleteSession,
  setSessionBackend,
  SESSION_COOKIE_NAME,
  MemorySessionBackend,
  UpstashSessionBackend,
  type SessionBackend,
  type UpstashCommandExecutor,
} from './session';

describe('session store — default in-memory backend', () => {
  beforeEach(() => {
    __resetSessionStoreForTests();
  });

  // Issue #1288 acceptance: pin the documented default down explicitly so
  // anyone changing buildDefaultBackend() without updating tests will trip.
  it('the active backend is the in-memory backend', () => {
    expect(getSessionBackend()).toBeInstanceOf(MemorySessionBackend);
  });

  it('createBrowserSession stores CSRF token retrievable by session id', () => {
    const { sessionId, csrfToken } = createBrowserSession('GADDR123');
    const rec = getSessionRecord(sessionId);
    expect(rec?.csrfToken).toBe(csrfToken);
    expect(rec?.walletAddress).toBe('GADDR123');
  });

  it('readSessionIdFromRequest reads cl_session from cookies', () => {
    const { sessionId } = createBrowserSession();
    const request = new NextRequest('http://localhost:3000/', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
    });
    expect(readSessionIdFromRequest(request.cookies)).toBe(sessionId);
  });

  it('rotateCsrfToken returns undefined for unknown session', () => {
    expect(rotateCsrfToken('unknown')).toBeUndefined();
  });

  it('rotateCsrfToken replaces CSRF token', () => {
    const { sessionId, csrfToken } = createBrowserSession();
    const next = rotateCsrfToken(sessionId);
    expect(next).toBeTruthy();
    expect(next).not.toBe(csrfToken);
    expect(getSessionRecord(sessionId)?.csrfToken).toBe(next);
  });

  it('deleteSession removes the record', () => {
    const { sessionId } = createBrowserSession();
    deleteSession(sessionId);
    expect(getSessionRecord(sessionId)).toBeUndefined();
  });

  it('readSessionIdFromRequest returns undefined when cookie absent', () => {
    const cookies = { get: () => undefined as { value: string } | undefined };
    expect(readSessionIdFromRequest(cookies)).toBeUndefined();
  });
});

describe('session store — pluggable backend injection (issue #1288 acceptance)', () => {
  // Snapshot the production-default backend so each test can restore it
  // after mutating the active backend.
  let originalBackend: SessionBackend;

  beforeEach(() => {
    __resetSessionStoreForTests();
    originalBackend = getSessionBackend();
  });

  afterEach(() => {
    setSessionBackend(originalBackend);
    __resetSessionStoreForTests();
  });

  it('setSessionBackend routes reads/writes through the injected backend', () => {
    const isolated = new MemorySessionBackend();
    setSessionBackend(isolated);

    const { sessionId, csrfToken } = createBrowserSession('GADDR123');
    expect(getSessionRecord(sessionId)?.csrfToken).toBe(csrfToken);

    // The injected backend holds the record, but the original backend does not.
    expect(isolated.get(sessionId)?.csrfToken).toBe(csrfToken);
    expect(originalBackend.get(sessionId)).toBeUndefined();
  });

  it('setSessionBackend supports a custom SessionBackend implementation', () => {
    const calls: string[] = [];
    const custom: SessionBackend = {
      get: () => undefined,
      set: (id) => calls.push(`set:${id}`),
      delete: (id) => calls.push(`delete:${id}`),
      clear: () => calls.push('clear'),
    };
    setSessionBackend(custom);

    const { sessionId } = createBrowserSession();
    deleteSession(sessionId);
    expect(calls).toEqual([`set:${sessionId}`, `delete:${sessionId}`]);
  });

  it('setSessionBackend rejects nullish inputs to prevent accidental no-op DI', () => {
    expect(() => setSessionBackend(null as unknown as SessionBackend)).toThrow(/SessionBackend/);
    expect(() => setSessionBackend(undefined as unknown as SessionBackend)).toThrow(
      /SessionBackend/,
    );
  });
});

describe('UpstashSessionBackend — clearAll() cursor loop (issue #1288 acceptance)', () => {
  /**
   * Helper: synthesise a fake Upstash executor that walks through a
   * pre-scripted transcript of SCAN replies. Tracks every command so we
   * can assert DEL was issued for every batch.
   */
  function scriptedExecutor(scanReplies: Array<[string, string[]]>): {
    executor: UpstashCommandExecutor;
    calls: unknown[][];
  } {
    const calls: unknown[][] = [];
    let scanIndex = 0;
    const executor: UpstashCommandExecutor = async (args) => {
      calls.push(args);
      const command = Array.isArray(args) ? args[0] : undefined;
      if (command === 'SCAN') {
        const reply = scanReplies[scanIndex];
        if (!reply) throw new Error('simulated network failure');
        scanIndex += 1;
        return [reply[0], reply[1]];
      }
      if (command === 'GET') return null;
      if (command === 'DEL') return String(args.slice(1).length);
      if (command === 'SET') return 'OK';
      return null;
    };
    return { executor, calls };
  }

  it('terminates the SCAN cursor loop and DELs every batch', async () => {
    const { executor, calls } = scriptedExecutor([
      ['42', ['cl:session:a', 'cl:session:b']],
      ['17', ['cl:session:c']],
      ['0', []],
    ]);

    const backend = new UpstashSessionBackend('https://example.invalid', 'token', executor);

    const result = await backend.clearAll();
    expect(result).toEqual({ scanned: 3, deleted: 3, errors: 0 });

    // Cursor was issued three times. Each DEL receives exactly the number
    // of keys that its source SCAN batch contained.
    const scanCalls = calls.filter((c) => c[0] === 'SCAN');
    const delBatchSizes = calls.filter((c) => c[0] === 'DEL').map((c) => c.length - 1);

    expect(scanCalls).toHaveLength(3);
    expect(delBatchSizes).toEqual([2, 1]);
  });

  it('terminates after a SCAN failure and reports the error', async () => {
    // First SCAN returns a non-zero cursor so the loop continues; second
    // hit exhausts the transcript and triggers the simulated failure.
    const { executor, calls } = scriptedExecutor([['7', ['cl:session:a', 'cl:session:b']]]);

    const backend = new UpstashSessionBackend('https://example.invalid', 'token', executor);

    const result = await backend.clearAll();
    expect(result.errors).toBe(1);
    expect(result.deleted).toBe(2);
    // First SCAN issued, batch deleted, second SCAN attempted then failed.
    const scanCalls = calls.filter((c) => c[0] === 'SCAN');
    expect(scanCalls.length).toBe(2);
  });

  it('exits prematurely if Upstash returns an unparsable shape', async () => {
    const executor: UpstashCommandExecutor = async () => 'not-an-array';
    const backend = new UpstashSessionBackend('https://example.invalid', 'token', executor);

    const result = await backend.clearAll();
    expect(result).toEqual({ scanned: 0, deleted: 0, errors: 0 });
  });
});

describe('__resetSessionStoreForTests — in-memory guard', () => {
  let originalBackend: SessionBackend;

  beforeEach(() => {
    originalBackend = getSessionBackend();
  });

  afterEach(() => {
    setSessionBackend(originalBackend);
  });

  it('throws when the active backend is not the in-memory backend', () => {
    setSessionBackend(
      new UpstashSessionBackend('https://example.invalid', 'token', async () => null),
    );
    expect(__resetSessionStoreForTests).toThrow(/MemorySessionBackend/);
  });
});
