import { randomBytes } from 'crypto';

/**
 * Browser session store with a pluggable backend.
 *
 * ## Production caveat
 *
 * The default `MemorySessionBackend` keeps every session in a process-local
 * `Map`. On serverless deployments (Vercel / Lambda / Cloud Run / Fly machines
 * with auto-scaling), cold-starts and concurrent invocations will lose every
 * session because each instance has its own in-memory map. CSRF tokens,
 * rotation, and "remember my wallet" all break the moment a request lands on
 * a different instance.
 *
 * To run safely in production, swap the backend for a persistent one (Redis,
 * Upstash, KV, etc.) by:
 *
 *   1. Implementing `SessionBackend` against your persistent store.
 *   2. Calling `__setSessionBackendForTests` at boot — or wiring it into
 *      a real env-driven factory in a follow-up patch.
 *
 * Without a persistent backend the session module is suitable for local
 * development and Vitest only.
 */

/** HttpOnly cookie holding opaque session id (server-side CSRF + session state). */
export const SESSION_COOKIE_NAME = 'cl_session';

const SESSION_ID_BYTES = 16;
const CSRF_TOKEN_BYTES = 32;

export interface BrowserSession {
  sessionId: string;
  csrfToken: string;
}

export interface SessionRecord {
  csrfToken: string;
  walletAddress?: string;
  createdAt: number;
}

/**
 * Storage contract for session records. Implementations may be in-memory,
 * Redis-backed, or any other persistent store.
 *
 * All methods are synchronous so the existing call sites keep working. A
 * future async-capable backend can wrap its work in deasync-style helpers,
 * or we can promote the API to async once callers are updated.
 */
export interface SessionBackend {
  /** Persist a record under `sessionId`. Overwrites any existing entry. */
  set(sessionId: string, record: SessionRecord): void;
  /** Return the record for `sessionId`, or `undefined` if missing. */
  get(sessionId: string): SessionRecord | undefined;
  /** Remove the record for `sessionId`. No-op if absent. */
  delete(sessionId: string): void;
  /** Test-only: clear every record. The default backend supports this. */
  clear?(): void;
}

/**
 * Default in-memory `SessionBackend`. Used in development and tests.
 *
 * Sessions are stored in a process-local `Map`, so they are lost across
 * serverless cold-starts and not shared between concurrent instances.
 */
export class MemorySessionBackend implements SessionBackend {
  private readonly store = new Map<string, SessionRecord>();

  set(sessionId: string, record: SessionRecord): void {
    this.store.set(sessionId, record);
  }

  get(sessionId: string): SessionRecord | undefined {
    return this.store.get(sessionId);
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
  }

  /** Drops every record — only used by tests and the public reset helper. */
  clear(): void {
    this.store.clear();
  }

  /** Returns the number of stored sessions — useful for diagnostics / tests. */
  size(): number {
    return this.store.size;
  }
}

let backend: SessionBackend = new MemorySessionBackend();

/** Returns the currently active session backend. */
export function getSessionBackend(): SessionBackend {
  return backend;
}

/**
 * Replaces the active session backend. Intended for tests and for wiring a
 * persistent (e.g. Redis) backend at boot.
 */
export function __setSessionBackendForTests(next: SessionBackend): void {
  backend = next;
}

/** Test-only: reset to a fresh in-memory backend. */
export function __resetSessionBackendForTests(): void {
  backend = new MemorySessionBackend();
}

/** True when the active backend is the in-memory default. */
export function isUsingInMemoryBackend(): boolean {
  return backend instanceof MemorySessionBackend;
}

function generateId(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Creates a new browser session with a CSRF synchronizer token stored server-side.
 */
export function createBrowserSession(walletAddress?: string): BrowserSession {
  const sessionId = generateId(SESSION_ID_BYTES);
  const csrfToken = generateId(CSRF_TOKEN_BYTES);
  backend.set(sessionId, {
    csrfToken,
    walletAddress,
    createdAt: Date.now(),
  });
  return { sessionId, csrfToken };
}

export function getSessionRecord(sessionId: string): SessionRecord | undefined {
  return backend.get(sessionId);
}

export function rotateCsrfToken(sessionId: string): string | undefined {
  const rec = backend.get(sessionId);
  if (!rec) return undefined;
  const next = generateId(CSRF_TOKEN_BYTES);
  rec.csrfToken = next;
  backend.set(sessionId, rec);
  return next;
}

export function deleteSession(sessionId: string): void {
  backend.delete(sessionId);
}

/** Test-only: clear every session between Vitest cases. */
export function __resetSessionStoreForTests(): void {
  if (typeof backend.clear === 'function') {
    backend.clear();
  } else {
    // Fall back to a fresh in-memory backend if the active one cannot clear.
    backend = new MemorySessionBackend();
  }
}

/** Parse session id from Cookie header (NextRequest#cookies). */
export function readSessionIdFromRequest(cookies: {
  get: (name: string) => { value: string } | undefined;
}): string | undefined {
  const raw = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw || raw.trim() === '') return undefined;
  return raw.trim();
}
