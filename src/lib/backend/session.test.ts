import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  __resetSessionStoreForTests,
  createBrowserSession,
  readSessionIdFromRequest,
  getSessionRecord,
  rotateCsrfToken,
  deleteSession,
  SESSION_COOKIE_NAME,
} from './session';

describe('session store', () => {
  beforeEach(() => {
    __resetSessionStoreForTests();
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
