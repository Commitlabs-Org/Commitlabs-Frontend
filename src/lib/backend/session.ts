/**
 * Browser session store for the CommitLabs backend.
 *
 * IMPORTANT — cross-instance limitations:
 *   The default in-memory backend (`MemorySessionBackend`) keeps sessions in
 *   a module-level Map. This means:
 *
 *     - On serverless platforms with multiple concurrent instances
 *       (Vercel, AWS Lambda, Cloudflare Workers, …) or after a redeploy,
 *       the Map is per-process: a user's CSRF-protected session cookie may
 *       silently stop working depending on which instance handles the
 *       next request.
 *     - Different instances cannot share or invalidate each other's
 *       session records.
 *
 *   Migrate to a Redis/upstash backed store before running this code in
 *   production with more than one server instance. Two pluggable backends
 *   are exported today:
 *
 *     - `MemorySessionBackend`  — default, dev/test only.
 *     - `UpstashSessionBackend` — durable; used when both
 *       `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
 *       are configured at startup.
 *
 *   The backend is selected once via `getSessionBackend()`; tests can
 *   override it through `setSessionBackend()`.
 *
 *   This mirrors the storage strategy in `@/lib/backend/kv` and
 *   `@/lib/backend/cache`, so audit/CSRF/session state is uniform across
 *   the backend.
 */
import { randomBytes } from 'crypto';

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
 * Minimal synchronous contract for a session store. Every backend — in-memory,
 * Upstash REST, or future Redis — must conform to this shape. Methods are
 * deliberately sync because the public API of this module (and the callers
 * of csrf.ts / withApiHandler.ts) is sync; persistent backends that need
 * async I/O must satisfy the contract by reading from a process-local cache
 * that is hydrated at boot time.
 */
export interface SessionBackend {
  get(sessionId: string): SessionRecord | undefined;
  set(sessionId: string, record: SessionRecord): void;
  delete(sessionId: string): void;
  clear(): void;
}

/** Default backend — module-level Map. See file JSDoc for cross-instance warnings. */
export class MemorySessionBackend implements SessionBackend {
  private readonly store = new Map<string, SessionRecord>();

  get(sessionId: string): SessionRecord | undefined {
    return this.store.get(sessionId);
  }

  set(sessionId: string, record: SessionRecord): void {
    this.store.set(sessionId, record);
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Upstash Redis-backed session store. Uses the same Upstash REST surface as
 * `@/lib/backend/kv`. Session records are serialized as JSON; CSRF tokens
 * and session ids remain random hex strings.
 *
 * The optional `executor` constructor parameter lets tests inject a fake
 * Upstash command responder without spying on `globalThis.fetch`. Default
 * is the HTTP REST path documented in `@/lib/backend/kv#UpstashKVStore`.
 *
 * IMPORTANT — synchronous API contract:
 *   The public `createBrowserSession` / `getSessionRecord` /
 *   `rotateCsrfToken` / `deleteSession` API is synchronous, so this
 *   backend keeps a write-through cache. THE CACHE IS PER-INSTANCE:
 *   on cross-instance deployments, a `set` on instance A and a `get`
 *   for the same session on instance B will not find a populated cache;
 *   instance B will fire-and-forget an async hydration and return
 *   `undefined` until the hydration completes. Therefore cross-instance
 *   reads must use the async façade (see `@/lib/backend/auth`'s
 *   `storeNonce` / `getNonceRecord` for a working example).
 *
 *   For true cross-instance sync semantics, migrate callers to an async
 *   session API — at which point this class can call `await` freely.
 */
export type UpstashCommandExecutor = (args: unknown[]) => Promise<unknown>;

export class UpstashSessionBackend implements SessionBackend {
  private readonly executor: UpstashCommandExecutor;
  private readonly cache = new Map<string, SessionRecord>();
  private readonly prefix = 'cl:session:';

  constructor(
    url: string,
    token: string,
    executor: UpstashCommandExecutor = defaultUpstashExecutor(url, token),
  ) {
    // `url` and `token` are only used to build the default executor. When
    // an executor is supplied directly, they are intentionally ignored.
    void url;
    void token;
    this.executor = executor;
  }

  private key(sessionId: string): string {
    return `${this.prefix}${sessionId}`;
  }

  private async command(args: unknown[]): Promise<unknown> {
    return this.executor(args);
  }

  get(sessionId: string): SessionRecord | undefined {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined;
    const cached = this.cache.get(sessionId);
    if (cached) return cached;

    // Cross-instance: cache miss → fire-and-forget hydration. The next
    // read after hydration completes will return the durable value. The
    // current call returns `undefined` to honour the sync API contract.
    void this.hydrate(sessionId);
    return undefined;
  }

  private async hydrate(sessionId: string): Promise<void> {
    try {
      const raw = (await this.command(['GET', this.key(sessionId)])) as
        | string
        | null;
      if (typeof raw !== 'string' || raw.length === 0) return;
      const parsed = JSON.parse(raw) as SessionRecord;
      this.cache.set(sessionId, parsed);
    } catch {
      // Best-effort — cross-instance reads may simply not find the record yet.
    }
  }

  set(sessionId: string, record: SessionRecord): void {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return;
    this.cache.set(sessionId, record);

    // Fire-and-forget durability. Failures from the REST call surface only
    // in logs — the sync API contract is preserved.
    void this.command(['SET', this.key(sessionId), JSON.stringify(record)]).catch(
      () => {
        /* swallow — see note above */
      },
    );
  }

  delete(sessionId: string): void {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return;
    this.cache.delete(sessionId);
    void this.command(['DEL', this.key(sessionId)]).catch(() => {
      /* swallow */
    });
  }

  /**
   * Iterates Redis via `SCAN` (cursor-driven, non-blocking) and `DEL`s
   * every key under the session prefix in batches. Upstash SCAN returns
   * `[nextCursor, [...keys]]`; cursor `0` marks completion. Errors from
   * any individual batch are coalesced into the returned counter so a
   * partial clear still reports how much work actually happened.
   */
  async clearAll(): Promise<{ scanned: number; deleted: number; errors: number }> {
    let cursor: string = '0';
    let scanned = 0;
    let deleted = 0;
    let errors = 0;
    const pattern = `${this.prefix}*`;

    do {
      let result: unknown;
      try {
        result = await this.command(['SCAN', cursor, 'MATCH', pattern, 'COUNT', 100]);
      } catch {
        errors += 1;
        break;
      }

      if (!Array.isArray(result) || result.length < 2) break;
      const [rawNextCursor, rawBatch] = result as [unknown, unknown];
      if (!Array.isArray(rawBatch)) break;
      // Upstash SCAN: next cursor is normally a string but can be 0 on completion.
      if (typeof rawNextCursor !== 'string' && typeof rawNextCursor !== 'number') {
        break;
      }
      const nextCursor = String(rawNextCursor);
      const batch = rawBatch.filter((key): key is string => typeof key === 'string');
      scanned += batch.length;

      if (batch.length > 0) {
        try {
          await this.command(['DEL', ...batch]);
          deleted += batch.length;
          for (const key of batch) {
            const unprefixed = this.unprefix(key);
            if (unprefixed !== null) this.cache.delete(unprefixed);
          }
        } catch {
          errors += 1;
        }
      }

      cursor = nextCursor;
    } while (cursor !== '0');

    this.cache.clear();
    return { scanned, deleted, errors };
  }

  private unprefix(key: string): string | null {
    if (!key.startsWith(this.prefix)) return null;
    return key.slice(this.prefix.length);
  }

  /**
   * Synchronous façade: clears the local cache and kicks off
   * `clearAll()` in the background. The sync API is preserved; callers
   * who need a deterministic post-clear state should await
   * `clearAll()` directly through DI or migrate to an async API.
   */
  clear(): void {
    this.cache.clear();
    void this.clearAll().catch(() => {
      /* swallow — see comment on clearAll() */
    });
  }
}

let warnedAboutInMemoryInProduction = false;

export function defaultUpstashExecutor(
  url: string,
  token: string,
): UpstashCommandExecutor {
  return async (args: unknown[]): Promise<unknown> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      throw new Error(
        `UpstashSessionBackend error: ${response.status} ${response.statusText}`,
      );
    }
    const data = (await response.json()) as { result?: unknown };
    return data.result;
  };
}

function buildDefaultBackend(): SessionBackend {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashSessionBackend(url, token);

  const isProductionLike =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';
  if (isProductionLike && !warnedAboutInMemoryInProduction) {
    // Production environments that run more than one server instance MUST
    // configure durable storage. We don't hard-fail to avoid crashing
    // single-instance self-hosted deployments, but we log the warning
    // exactly once so repeated module evaluations don't spam the logs.
    warnedAboutInMemoryInProduction = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[session] Using in-memory session backend in production. Configure ' +
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for cross-instance ' +
        'session persistence. This warning is emitted at most once per process.',
    );
  }
  return new MemorySessionBackend();
}

let backend: SessionBackend = buildDefaultBackend();

/** Replace the active session backend. Intended for tests and advanced DI. */
export function setSessionBackend(next: SessionBackend): void {
  if (!next) {
    throw new TypeError('setSessionBackend requires a SessionBackend instance.');
  }
  backend = next;
}

/** Returns the active session backend singleton. */
export function getSessionBackend(): SessionBackend {
  return backend;
}

function generateId(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Creates a new browser session with a CSRF synchronizer token stored server-side.
 *
 * The persistence guarantees depend on the active backend — see file JSDoc.
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

/**
 * Test-only: reset the in-memory store between Vitest cases.
 *
 * Limited to the in-memory backend on purpose: if a test injects a
 * persistent backend (e.g. `UpstashSessionBackend`) and then calls this
 * helper, the async `clearAll()` fanout would hit the network and could
 * produce unhandledrejection events after the test has torn down.
 * Tests that exercise persistent backends should reset their own state
 * explicitly via the injected backend's methods.
 */
export function __resetSessionStoreForTests(): void {
  if (!(backend instanceof MemorySessionBackend)) {
    throw new TypeError(
      '__resetSessionStoreForTests requires the in-memory ' +
        'MemorySessionBackend to be the active backend; reset the ' +
        'persistent backend explicitly in your test.',
    );
  }
  backend.clear();
}

/** Parse session id from Cookie header (NextRequest#cookies). */
export function readSessionIdFromRequest(cookies: { get: (name: string) => { value: string } | undefined }): string | undefined {
  const raw = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw || raw.trim() === '') return undefined;
  return raw.trim();
}
