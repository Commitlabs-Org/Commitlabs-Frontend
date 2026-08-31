/**
 * @file /api/user/preferences
 *
 * GET  – Returns the authenticated wallet's current preferences.
 *        Missing preferences are initialised to `DEFAULT_PREFERENCES`.
 *        Supports conditional requests via ETag / If-None-Match for
 *        multi-tab and cross-session consistency.
 *        Rate-limited: max 2 req/s per wallet.
 *
 * PUT  – Partially updates the authenticated wallet's preferences.
 *        Only supplied fields are written; omitted fields retain their
 *        previous values (deep-merge semantics).
 *        Requests queued if wallet exceeds max concurrent mutations (3).
 *
 * State-machine invariants
 * ────────────────────────
 * Preferences have two logical states:
 *   DEFAULT → PERSONALISED
 *
 * Transitions are idempotent and version-protected:
 * • The client may supply an `Idempotency-Key` header. A repeated PUT with
 *   the same key (within 24 h) returns the cached result verbatim — safe
 *   for retries after network interruptions.
 * • The client may supply an `If-Match` header containing the ETag of the
 *   version it last read. If the stored version has changed since then the
 *   request is rejected with 412 Precondition Failed, preventing stale
 *   overwrites across concurrent tabs / sessions.
 * • An interrupted write that committed to the store but never returned a
 *   response to the client is recovered on retry via the Idempotency-Key.
 * • Rate limits: max 2 GET req/s, max 3 concurrent PUT mutations per wallet.
 * • Circuit breaker: 10% error rate over 60s opens circuit for 30s.
 *
 * Auth
 * ────
 * Both methods require a valid `Authorization: Bearer <sessionToken>` header.
 * Missing / invalid tokens yield 401 Unauthorized.
 *
 * Validation
 * ──────────
 * PUT bodies are validated with `userPreferencesSchema` (Zod).
 * Validation failures yield 400 with field-level error details.
 * Maximum request body size: 64 KiB.
 *
 * Diagnostics
 * ───────────
 * All operations are tracked for latency, errors, and operational health.
 * Diagnostic events contain no secrets; wallet addresses are hashed.
 */

import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { ValidationError, ConflictError, TooManyRequestsError, ServiceUnavailableError, PayloadTooLargeError } from '@/lib/backend/errors';
import { generateETag } from '@/lib/backend/etag';
import { IdempotencyService } from '@/lib/backend/idempotency';
import {
  userPreferencesSchema,
  DEFAULT_PREFERENCES,
  jsonFilePreferencesStore,
  requireWalletAuth,
  type PreferencesStore,
  type UserPreferences,
} from '@/lib/backend/preferences';
import {
  PREFERENCE_BOUNDS,
  RateLimitTracker,
  ErrorRateTracker,
  ConcurrentMutationTracker,
} from '@/lib/backend/notificationBounds';
import {
  OperationDiagnostics,
  globalDiagnosticsCollector,
  generateTraceId,
} from '@/lib/backend/notificationDiagnostics';

// ─── Store injection (test seam) ─────────────────────────────────────────────

let _store: PreferencesStore = jsonFilePreferencesStore;
export function __setStoreForTesting(store: PreferencesStore): void {
  _store = store;
}
export function __resetStore(): void {
  _store = jsonFilePreferencesStore;
}

// ─── Idempotency service (test seam) ─────────────────────────────────────────

const _defaultIdempotency = new IdempotencyService(undefined, 86400);
let _idempotency: IdempotencyService = _defaultIdempotency;

export function __setIdempotencyForTesting(svc: IdempotencyService): void {
  _idempotency = svc;
}
export function __resetIdempotency(): void {
  _idempotency = _defaultIdempotency;
}

// ─── Bounds and diagnostics state ────────────────────────────────────────────

const getRequestLimiter = new RateLimitTracker();
const errorRateTracker = new ErrorRateTracker();
const mutationLimiter = new ConcurrentMutationTracker();

export function __resetBoundsForTesting(): void {
  getRequestLimiter.reset();
  errorRateTracker.reset();
  mutationLimiter.reset();
}

export function __getDiagnosticsForTesting() {
  return { getRequestLimiter, errorRateTracker, mutationLimiter };
}

// ─── GET /api/user/preferences ───────────────────────────────────────────────

/**
 * @openapi
 * /api/user/preferences:
 *   get:
 *     summary: Retrieve user preferences
 *     description: >
 *       Returns display and notification preferences for the authenticated wallet.
 *       Defaults are returned when no preferences have been saved yet.
 *       Supports If-None-Match / ETag for efficient polling across tabs.
 *       
 *       Rate limited: maximum 2 requests per second per wallet.
 *       Circuit breaker: opens after 10% error rate over 60 seconds.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences object
 *         headers:
 *           ETag:
 *             description: Opaque version token for conditional PUT requests
 *             schema: { type: string }
 *       304:
 *         description: Preferences unchanged (conditional request, ETag matched)
 *       401:
 *         description: Authentication required
 *       429:
 *         description: Rate limited — too many requests
 *       503:
 *         description: Circuit breaker open — service degraded
 */
export const GET = withApiHandler(
  async (req: NextRequest) => {
    const traceId = generateTraceId();

    try {
      const authHeader = req.headers.get('authorization');
      const address = requireWalletAuth(authHeader);
      const diag = new OperationDiagnostics('GET', address, traceId);

      // Check circuit breaker before rate limiting
      if (errorRateTracker.isCircuitOpen(address, PREFERENCE_BOUNDS.CIRCUIT_BREAK_DURATION_MS)) {
        diag.warn('Circuit breaker open for wallet');
        globalDiagnosticsCollector.addEvent(diag.summarize(503, true));
        throw new ServiceUnavailableError(
          'Preference service temporarily unavailable. Please try again shortly.',
        );
      }

      // Rate limiting: check if wallet is sending too many GET requests
      const isRateLimited = getRequestLimiter.isRateLimited(
        address,
        PREFERENCE_BOUNDS.MAX_GET_RPS,
        PREFERENCE_BOUNDS.RATE_LIMIT_WINDOW_MS,
      );

      if (isRateLimited) {
        diag.warn('Rate limit exceeded for GET request');
        errorRateTracker.recordError(address, PREFERENCE_BOUNDS.ERROR_WINDOW_MS);
        globalDiagnosticsCollector.addEvent(diag.summarize(429, true));
        throw new TooManyRequestsError(
          `Rate limit exceeded. Maximum ${PREFERENCE_BOUNDS.MAX_GET_RPS} requests per second allowed.`,
        );
      }

      // Record this request for rate limiting
      getRequestLimiter.recordRequest(address, PREFERENCE_BOUNDS.RATE_LIMIT_WINDOW_MS);
      diag.info(`Rate limit check passed (${getRequestLimiter.getRequestCount(address, PREFERENCE_BOUNDS.RATE_LIMIT_WINDOW_MS)}/${PREFERENCE_BOUNDS.MAX_GET_RPS})`);

      const stored = await _store.get(address);
      const preferences: UserPreferences = stored ?? { ...DEFAULT_PREFERENCES };

      const response = { address, preferences };
      const responseJson = JSON.stringify(response);

      diag.setResponseSize(responseJson.length);
      diag.info('Preferences retrieved successfully');

      errorRateTracker.recordSuccess(address, PREFERENCE_BOUNDS.ERROR_WINDOW_MS);
      globalDiagnosticsCollector.addEvent(diag.summarize(200));

      return ok(response);
    } catch (err) {
      // Try to get address for error tracking (may not have succeeded in auth)
      try {
        const authHeader = req.headers.get('authorization');
        const address = requireWalletAuth(authHeader);
        errorRateTracker.recordError(address, PREFERENCE_BOUNDS.ERROR_WINDOW_MS);
        const threshold = PREFERENCE_BOUNDS.ERROR_RATE_THRESHOLD;
        const opened = errorRateTracker.checkAndOpenCircuit(
          address,
          threshold,
          PREFERENCE_BOUNDS.ERROR_WINDOW_MS,
        );
        if (opened) {
          const diag = new OperationDiagnostics('GET', address, traceId);
          diag.warn(`Circuit breaker opened (error rate >= ${threshold}%)`);
          globalDiagnosticsCollector.addEvent(diag.summarize(undefined, true));
        }
      } catch {
        // Auth failed, skip tracking
      }
      throw err;
    }
  },
  { enableETag: true, cachePrivacy: 'private' },
);

// ─── PUT /api/user/preferences ───────────────────────────────────────────────

/**
 * @openapi
 * /api/user/preferences:
 *   put:
 *     summary: Update user preferences
 *     description: >
 *       Partially updates preferences for the authenticated wallet.
 *       Only provided fields are overwritten (deep merge).
 *
 *       Idempotency: supply `Idempotency-Key: <uuid>` to make the operation
 *       safe to retry — the same key within 24h returns the cached result.
 *
 *       Optimistic concurrency: supply `If-Match: "<etag>"` (the ETag from
 *       the most recent GET response) to prevent overwriting a version you
 *       have not seen. Returns 412 if the stored version has changed.
 *       
 *       Concurrent limits: maximum 3 mutations per wallet (queued if exceeded).
 *       Timeout: 5 seconds per operation.
 *       Maximum body size: 64 KiB.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: Idempotency-Key
 *         in: header
 *         schema: { type: string, maxLength: 512 }
 *         description: Optional client-generated unique key for retry safety
 *       - name: If-Match
 *         in: header
 *         schema: { type: string }
 *         description: Optional ETag for optimistic concurrency control
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserPreferencesInput'
 *     responses:
 *       200:
 *         description: Updated preferences
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       412:
 *         description: Precondition failed — stored version changed since If-Match ETag was issued
 *       413:
 *         description: Request body too large (max 64 KiB)
 *       503:
 *         description: Circuit breaker open — service degraded
 */
export const PUT = withApiHandler(async (req: NextRequest) => {
  const traceId = generateTraceId();

  try {
    const authHeader = req.headers.get('authorization');
    const address = requireWalletAuth(authHeader);
    const diag = new OperationDiagnostics('PUT', address, traceId);

    // Check circuit breaker
    if (errorRateTracker.isCircuitOpen(address, PREFERENCE_BOUNDS.CIRCUIT_BREAK_DURATION_MS)) {
      diag.warn('Circuit breaker open');
      globalDiagnosticsCollector.addEvent(diag.summarize(503, true));
      throw new ServiceUnavailableError(
        'Preference service temporarily unavailable. Please try again shortly.',
      );
    }

    // Acquire mutation slot (waits if queue is full)
    const releaseSlot = await mutationLimiter.acquire(
      address,
      PREFERENCE_BOUNDS.MAX_CONCURRENT_MUTATIONS,
    );
    const inFlight = mutationLimiter.getInFlight(address);
    const queued = mutationLimiter.getQueued(address);
    diag.info(`Mutation slot acquired (${inFlight} in-flight, ${queued} queued)`);

    try {
      // Check idempotency key length
      const idempotencyKey = req.headers.get('idempotency-key');
      if (idempotencyKey && idempotencyKey.length > PREFERENCE_BOUNDS.MAX_IDEMPOTENCY_KEY_LENGTH) {
        diag.error('Idempotency key too long', 'IDEMPOTENCY_KEY_TOO_LONG');
        throw new ValidationError(
          `Idempotency-Key must be at most ${PREFERENCE_BOUNDS.MAX_IDEMPOTENCY_KEY_LENGTH} characters.`,
        );
      }

      const scopedKey = idempotencyKey ? `prefs:${address}:${idempotencyKey}` : null;

      // Check idempotency cache
      if (scopedKey) {
        const cached = await _idempotency.getRecord<{ address: string; preferences: UserPreferences }>(
          scopedKey,
        );
        if (cached?.status === 'COMPLETED' && cached.response) {
          diag.info('Returning cached result');
          diag.setIdempotencyHit(true);
          errorRateTracker.recordSuccess(address, PREFERENCE_BOUNDS.ERROR_WINDOW_MS);
          globalDiagnosticsCollector.addEvent(diag.summarize(200));
          return ok({ ...cached.response, fromCache: true });
        }
      }

      // Parse body with size limit
      let body: unknown;
      try {
        const text = await req.text();
        const bodySize = Buffer.byteLength(text, 'utf8');

        if (bodySize > PREFERENCE_BOUNDS.MAX_BODY_SIZE_BYTES) {
          diag.error('Request body too large', 'PAYLOAD_TOO_LARGE');
          throw new PayloadTooLargeError(
            `Request body exceeds maximum size of ${PREFERENCE_BOUNDS.MAX_BODY_SIZE_BYTES} bytes.`,
          );
        }

        diag.setRequestSize(bodySize);
        body = JSON.parse(text);
      } catch (err) {
        if (err instanceof PayloadTooLargeError) throw err;
        diag.error('JSON parse failed', 'JSON_PARSE_ERROR');
        throw new ValidationError('Request body must be valid JSON.');
      }

      // Validate with schema
      const result = userPreferencesSchema.safeParse(body);
      if (!result.success) {
        diag.error('Body validation failed', 'VALIDATION_ERROR');
        const details = result.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        throw new ValidationError('Invalid preference data.', details);
      }

      if (Object.keys(result.data).length === 0) {
        diag.error('Empty preferences', 'EMPTY_PREFERENCES');
        throw new ValidationError('Request body must contain at least one preference field.');
      }

      // Optimistic concurrency (If-Match)
      const ifMatch = req.headers.get('if-match');
      if (ifMatch) {
        const current = await _store.get(address);
        const currentPrefs: UserPreferences = current ?? { ...DEFAULT_PREFERENCES };
        const currentETag = generateETag({ address, preferences: currentPrefs });

        // Normalize both sides to bare hash strings for comparison.
        const normalize = (tag: string) => tag.replace(/^W\//i, '').replace(/^"|"$/g, '');
        if (normalize(ifMatch) !== normalize(currentETag)) {
          diag.error('ETag mismatch', 'ETAG_MISMATCH');
          throw new ConflictError(
            'Preferences have been modified since your last read. Fetch the current version and retry.',
          );
        }
        diag.info('ETag validation passed');
      }

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Mutation timeout'));
        }, PREFERENCE_BOUNDS.MUTATION_TIMEOUT_MS);
      });

      // Apply update with timeout
      const updatePromise = _store.upsert(address, result.data);
      const preferences = await Promise.race([updatePromise, timeoutPromise]);

      diag.info('Preferences updated successfully');

      const responsePayload = { address, preferences, fromCache: false as boolean | undefined };

      // Record idempotency result
      if (scopedKey) {
        await _idempotency.complete(
          scopedKey,
          { address, preferences },
          200,
        );
        diag.info('Idempotency result recorded');
      }

      const responseJson = JSON.stringify(responsePayload);
      diag.setResponseSize(Buffer.byteLength(responseJson, 'utf8'));

      errorRateTracker.recordSuccess(address, PREFERENCE_BOUNDS.ERROR_WINDOW_MS);
      globalDiagnosticsCollector.addEvent(diag.summarize(200));

      return ok(responsePayload);
    } finally {
      releaseSlot();
    }
  } catch (err) {
    // Try to get address for error tracking (may not have succeeded in auth)
    try {
      const authHeader = req.headers.get('authorization');
      const address = requireWalletAuth(authHeader);
      errorRateTracker.recordError(address, PREFERENCE_BOUNDS.ERROR_WINDOW_MS);
      const threshold = PREFERENCE_BOUNDS.ERROR_RATE_THRESHOLD;
      const opened = errorRateTracker.checkAndOpenCircuit(
        address,
        threshold,
        PREFERENCE_BOUNDS.ERROR_WINDOW_MS,
      );
      if (opened) {
        const diag = new OperationDiagnostics('PUT', address, traceId);
        diag.warn(`Circuit breaker opened (error rate >= ${threshold}%)`);
        globalDiagnosticsCollector.addEvent(diag.summarize(undefined, true));
      }
    } catch {
      // Auth failed, skip tracking
    }
    throw err;
  }
});
