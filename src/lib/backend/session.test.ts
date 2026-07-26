import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  __resetSessionStoreForTests,
  __resetSessionBackendForTests,
  __setSessionBackendForTests,
  createBrowserSession,
  readSessionIdFromRequest,
  getSessionRecord,
  rotateCsrfToken,
  deleteSession,
  getSessionBackend,
  isUsingInMemoryBackend,
  MemorySessionBackend,
  SESSION_COOKIE_NAME,
} from './session';

describe('session store', () => {
  beforeEach(() => {
    __resetSessionStoreForTests();
    __resetSessionBackendForTests();
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
    const cookies = {
      get: () => undefined as { value: string } | undefined,
    };
    expect(readSessionIdFromRequest(cookies)).toBeUndefined();
  });
});

describe('session backend (pluggable)', () => {
  beforeEach(() => {
    __resetSessionStoreForTests();
    __resetSessionBackendForTests();
  });

  it('defaults to MemorySessionBackend', () => {
    expect(getSessionBackend()).toBeInstanceOf(MemorySessionBackend);
    expect(isUsingInMemoryBackend()).toBe(true);
  });

  it('exposes a SessionBackend interface that can be swapped', () => {
    const fakeStore = new Map<string, NonNullable<ReturnType<typeof getSessionRecord>>>();
    const fakeBackend = {
      set(id: string, rec: NonNullable<ReturnType<typeof getSessionRecord>>) {
        fakeStore.set(id, rec);
      },
      get(id: string) {
        return fakeStore.get(id);
      },
      delete(id: string) {
        fakeStore.delete(id);
      },
    };

    __setSessionBackendForTests(fakeBackend);
    expect(isUsingInMemoryBackend()).toBe(false);

    const { sessionId, csrfToken } = createBrowserSession('GADDR_FAKE');
    const rec = getSessionRecord(sessionId);
    expect(rec?.csrfToken).toBe(csrfToken);
    expect(rec?.walletAddress).toBe('GADDR_FAKE');
    expect(fakeStore.has(sessionId)).toBe(true);

    deleteSession(sessionId);
    expect(getSessionRecord(sessionId)).toBeUndefined();
    expect(fakeStore.has(sessionId)).toBe(false);
  });

  it('falls back to a fresh MemorySessionBackend when reset is called on a clear-less backend', () => {
    const clearLessBackend = {
      set: () => {
        /* no-op */
      },
      get: () => undefined,
      delete: () => {
        /* no-op */
      },
      // intentionally no `clear` method
    };

    __setSessionBackendForTests(clearLessBackend);
    expect(isUsingInMemoryBackend()).toBe(false);

    // Should not throw even though the active backend has no `clear`.
    expect(() => __resetSessionStoreForTests()).not.toThrow();
    expect(isUsingInMemoryBackend()).toBe(true);
  });

  it('MemorySessionBackend.clear drops every record', () => {
    const backend = new MemorySessionBackend();
    __setSessionBackendForTests(backend);

    createBrowserSession();
    createBrowserSession();
    expect(backend.size()).toBe(2);
    __resetSessionStoreForTests();
    expect(backend.size()).toBe(0);
  });

  it('rotateCsrfToken persists through a swapped backend', () => {
    const backend = new MemorySessionBackend();
    __setSessionBackendForTests(backend);
    const { sessionId, csrfToken } = createBrowserSession();
    const rotated = rotateCsrfToken(sessionId);
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(csrfToken);
    expect(getSessionRecord(sessionId)?.csrfToken).toBe(rotated);
  });
});