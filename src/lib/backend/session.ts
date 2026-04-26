import { randomBytes } from 'crypto';

/** HttpOnly cookie holding opaque session id (server-side CSRF + session state). */
export const SESSION_COOKIE_NAME = 'cl_session';

const SESSION_ID_BYTES = 16;
const CSRF_TOKEN_BYTES = 32;

export interface BrowserSession {
  sessionId: string;
  csrfToken: string;
}

interface SessionRecord {
  csrfToken: string;
  walletAddress?: string;
  createdAt: number;
}

const sessionStore = new Map<string, SessionRecord>();

function generateId(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Creates a new browser session with a CSRF synchronizer token stored server-side.
 */
export function createBrowserSession(walletAddress?: string): BrowserSession {
  const sessionId = generateId(SESSION_ID_BYTES);
  const csrfToken = generateId(CSRF_TOKEN_BYTES);
  sessionStore.set(sessionId, {
    csrfToken,
    walletAddress,
    createdAt: Date.now(),
  });
  return { sessionId, csrfToken };
}

export function getSessionRecord(sessionId: string): SessionRecord | undefined {
  return sessionStore.get(sessionId);
}

export function rotateCsrfToken(sessionId: string): string | undefined {
  const rec = sessionStore.get(sessionId);
  if (!rec) return undefined;
  const next = generateId(CSRF_TOKEN_BYTES);
  rec.csrfToken = next;
  return next;
}

export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

/** Test-only: clear in-memory sessions between Vitest cases. */
export function __resetSessionStoreForTests(): void {
  sessionStore.clear();
}

/** Parse session id from Cookie header (NextRequest#cookies). */
export function readSessionIdFromRequest(cookies: { get: (name: string) => { value: string } | undefined }): string | undefined {
  const raw = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw || raw.trim() === '') return undefined;
  return raw.trim();
}
