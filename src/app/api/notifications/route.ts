/**
 * @file /api/notifications
 *
 * GET   – Returns paginated notifications for the authenticated wallet.
 *         Optional `?unreadOnly=true` filters to unread-only.
 *         Supports If-None-Match / ETag for conditional polling.
 *         Rate-limited per wallet (max 2 req/s).
 *
 * PATCH – Transitions a notification's state via the deterministic state machine.
 *         Body: { id: string; action: 'mark_read' | 'acknowledge'; idempotencyKey: string }
 *         Requests queued if wallet exceeds max concurrent mutations (5).
 *
 * State machine
 * ─────────────
 *   UNREAD ──► READ ──► ACKNOWLEDGED
 *
 * Invariants
 * ──────────
 * • Only the notification's ownerAddress may mutate it.
 * • Transitions are idempotent: replaying the same (idempotencyKey) returns
 *   the cached result without re-applying the transition.
 * • Forward-only: backward transitions are rejected with 409 Conflict.
 * • ACKNOWLEDGED is terminal: further transitions are rejected with 409.
 * • Duplicate submissions (same idempotencyKey) never cause on-store side-effects.
 * • Rate limits: max 2 GET req/s, max 5 concurrent PATCH mutations per wallet.
 * • Circuit breaker: 10% error rate over 60s opens circuit for 30s.
 *
 * Auth
 * ────
 * Both methods require `Authorization: Bearer <sessionToken>`.
 * Missing / invalid tokens yield 401 Unauthorized.
 *
 * Diagnostics
 * ───────────
 * All operations are tracked for latency, errors, and operational health.
 * Diagnostic events contain no secrets; wallet addresses are hashed.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { ValidationError, TooManyRequestsError, ServiceUnavailableError } from '@/lib/backend/errors';
import { requireWalletAuth } from '@/lib/backend/preferences';
import {
  getNotificationStore,
  setNotificationStoreForTesting,
  resetNotificationStore,
  notificationIdempotency,
  NotificationTransitionService,
  InMemoryNotificationStore,
} from '@/lib/backend/notificationStateMachine';
import { IdempotencyService } from '@/lib/backend/idempotency';
import {
  NOTIFICATION_BOUNDS,
  RateLimitTracker,
  ErrorRateTracker,
  ConcurrentMutationTracker,
} from '@/lib/backend/notificationBounds';
import {
  OperationDiagnostics,
  globalDiagnosticsCollector,
  generateTraceId,
} from '@/lib/backend/notificationDiagnostics';

export {
  setNotificationStoreForTesting as __setStoreForTesting,
  resetNotificationStore as __resetStore,
};

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

// ─── Seeded demo data ─────────────────────────────────────────────────────────
// Populate the singleton store on first import so integration tests and local
// dev always have something to work with. Real deployments replace this with
// DB-backed seeding.

let _seeded = false;
async function ensureSeeded(): Promise<void> {
  if (_seeded) return;
  _seeded = true;

  const store = getNotificationStore();
  if (!(store instanceof InMemoryNotificationStore)) return;

  // Only seed if empty
  const sample = await store.list('SEED_PLACEHOLDER', { page: 1, pageSize: 1 });
  if (sample.total > 0) return;

  await store.seed(
    Array.from({ length: 12 }, (_, i) => ({
      id: `notif-seed-${i + 1}`,
      ownerAddress: 'DEMO_OWNER',
      title: `Demo Notification ${i + 1}`,
      message: `This is demo notification ${i + 1}.`,
      severity: (['info', 'warning', 'critical'] as const)[i % 3],
      type: (['expiry', 'violation', 'health_check', 'marketplace'] as const)[i % 4],
      read: false,
      createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
    })),
  );
}

// ─── Query validation (with bounds) ──────────────────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, 'page must be at least 1')
    .max(NOTIFICATION_BOUNDS.MAX_PAGE_NUMBER, `page must be at most ${NOTIFICATION_BOUNDS.MAX_PAGE_NUMBER}`)
    .default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(NOTIFICATION_BOUNDS.MIN_PAGE_SIZE, `pageSize must be at least ${NOTIFICATION_BOUNDS.MIN_PAGE_SIZE}`)
    .max(NOTIFICATION_BOUNDS.MAX_PAGE_SIZE, `pageSize must be at most ${NOTIFICATION_BOUNDS.MAX_PAGE_SIZE}`)
    .default(NOTIFICATION_BOUNDS.DEFAULT_PAGE_SIZE),
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

// ─── PATCH body validation (with bounds) ────────────────────────────────────

const patchBodySchema = z.object({
  id: z.string().min(1, 'Notification id is required'),
  action: z.enum(['mark_read', 'acknowledge'], {
    errorMap: () => ({ message: "action must be 'mark_read' or 'acknowledge'" }),
  }),
  /**
   * Client-supplied idempotency key. Must be unique per intended logical
   * operation. A UUID is recommended. Re-sending the same key within 24h
   * returns the previously committed result without re-executing the transition.
   */
  idempotencyKey: z.string()
    .min(1, 'idempotencyKey is required')
    .max(NOTIFICATION_BOUNDS.MAX_IDEMPOTENCY_KEY_LENGTH, `idempotencyKey must be at most ${NOTIFICATION_BOUNDS.MAX_IDEMPOTENCY_KEY_LENGTH} characters`),
});

// ─── Idempotency and transition service ──────────────────────────────────────

let _idempotencyService: IdempotencyService = notificationIdempotency;

/** Replace idempotency service in tests. */
export function __setIdempotencyServiceForTesting(svc: IdempotencyService): void {
  _idempotencyService = svc;
}
export function __resetIdempotencyService(): void {
  _idempotencyService = notificationIdempotency;
}

function getTransitionService(): NotificationTransitionService {
  return new NotificationTransitionService(getNotificationStore(), _idempotencyService);
}

// ─── GET /api/notifications ───────────────────────────────────────────────────

export const GET = withApiHandler(
  async (req: NextRequest) => {
    const traceId = generateTraceId();

    try {
      // Extract and validate auth
      const authHeader = req.headers.get('authorization');
      const address = requireWalletAuth(authHeader);
      const diag = new OperationDiagnostics('GET', address, traceId);

      // Check circuit breaker before rate limiting
      if (errorRateTracker.isCircuitOpen(address, NOTIFICATION_BOUNDS.CIRCUIT_BREAK_DURATION_MS)) {
        diag.warn('Circuit breaker open for wallet');
        globalDiagnosticsCollector.addEvent(diag.summarize(503, true));
        throw new ServiceUnavailableError(
          'Notification service temporarily unavailable. Please try again shortly.',
        );
      }

      // Rate limiting: check if wallet is sending too many GET requests
      const isRateLimited = getRequestLimiter.isRateLimited(
        address,
        NOTIFICATION_BOUNDS.MAX_GET_RPS,
        NOTIFICATION_BOUNDS.RATE_LIMIT_WINDOW_MS,
      );

      if (isRateLimited) {
        diag.warn('Rate limit exceeded for GET request');
        errorRateTracker.recordError(address, NOTIFICATION_BOUNDS.ERROR_WINDOW_MS);
        globalDiagnosticsCollector.addEvent(diag.summarize(429, true));
        throw new TooManyRequestsError(
          `Rate limit exceeded. Maximum ${NOTIFICATION_BOUNDS.MAX_GET_RPS} requests per second allowed.`,
        );
      }

      // Record this request for rate limiting
      getRequestLimiter.recordRequest(address, NOTIFICATION_BOUNDS.RATE_LIMIT_WINDOW_MS);
      diag.info(`Rate limit check passed (${getRequestLimiter.getRequestCount(address, NOTIFICATION_BOUNDS.RATE_LIMIT_WINDOW_MS)}/${NOTIFICATION_BOUNDS.MAX_GET_RPS})`);

      // Ensure demo data is seeded
      await ensureSeeded();

      // Parse and validate query parameters
      const { searchParams } = new URL(req.url);
      const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
      if (!parsed.success) {
        diag.error('Query validation failed', 'INVALID_QUERY');
        throw new ValidationError(
          'Invalid query parameters',
          parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        );
      }

      const { page, pageSize, unreadOnly } = parsed.data;
      diag.info(`Fetching page=${page} pageSize=${pageSize} unreadOnly=${unreadOnly}`);

      // Fetch notifications from store
      const store = getNotificationStore();
      const { items, total } = await store.list(address, { page, pageSize, unreadOnly });

      const response = { items, meta: { page, pageSize, total, unreadOnly } };
      const responseJson = JSON.stringify(response);

      diag.setResponseSize(responseJson.length);
      diag.info(`Retrieved ${items.length} notifications (${total} total)`);

      errorRateTracker.recordSuccess(address, NOTIFICATION_BOUNDS.ERROR_WINDOW_MS);
      globalDiagnosticsCollector.addEvent(diag.summarize(200));

      return ok(response);
    } catch (err) {
      // Try to get address for error tracking (may not have succeeded in auth)
      try {
        const authHeader = req.headers.get('authorization');
        const address = requireWalletAuth(authHeader);
        errorRateTracker.recordError(address, NOTIFICATION_BOUNDS.ERROR_WINDOW_MS);
        const threshold = NOTIFICATION_BOUNDS.ERROR_RATE_THRESHOLD;
        const opened = errorRateTracker.checkAndOpenCircuit(
          address,
          threshold,
          NOTIFICATION_BOUNDS.ERROR_WINDOW_MS,
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

// ─── PATCH /api/notifications ─────────────────────────────────────────────────

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const traceId = generateTraceId();

  try {
    // Extract and validate auth
    const authHeader = req.headers.get('authorization');
    const address = requireWalletAuth(authHeader);
    const diag = new OperationDiagnostics('PATCH', address, traceId);

    // Check circuit breaker
    if (errorRateTracker.isCircuitOpen(address, NOTIFICATION_BOUNDS.CIRCUIT_BREAK_DURATION_MS)) {
      diag.warn('Circuit breaker open');
      globalDiagnosticsCollector.addEvent(diag.summarize(503, true));
      throw new ServiceUnavailableError(
        'Notification service temporarily unavailable. Please try again shortly.',
      );
    }

    // Acquire mutation slot (waits if queue is full)
    const releaseSlot = await mutationLimiter.acquire(
      address,
      NOTIFICATION_BOUNDS.MAX_CONCURRENT_MUTATIONS,
    );
    const inFlight = mutationLimiter.getInFlight(address);
    const queued = mutationLimiter.getQueued(address);
    diag.info(`Mutation slot acquired (${inFlight} in-flight, ${queued} queued)`);

    try {
      // Parse body
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        diag.error('JSON parse failed', 'JSON_PARSE_ERROR');
        throw new ValidationError('Request body must be valid JSON.');
      }

      const result = patchBodySchema.safeParse(body);
      if (!result.success) {
        diag.error('Body validation failed', 'VALIDATION_ERROR');
        throw new ValidationError(
          'Invalid request body.',
          result.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        );
      }

      const { id, action, idempotencyKey } = result.data;

      // Map action → state machine event
      const event = action === 'mark_read' ? 'MARK_READ' : 'ACKNOWLEDGE';

      // Scope the idempotency key to (caller, key) so two different wallets
      // cannot inadvertently share the same cache slot.
      const scopedKey = `notif:${address}:${idempotencyKey}`;

      diag.info(`Transitioning notification ${id} via ${event}`);

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Mutation timeout'));
        }, NOTIFICATION_BOUNDS.MUTATION_TIMEOUT_MS);
      });

      const svc = getTransitionService();
      const transitionPromise = svc.transition(id, event, address, scopedKey);

      const { notification, fromCache } = await Promise.race([
        transitionPromise,
        timeoutPromise,
      ]);

      diag.info(`Transition completed${fromCache ? ' (cached)' : ''}`);
      diag.setIdempotencyHit(fromCache);

      errorRateTracker.recordSuccess(address, NOTIFICATION_BOUNDS.ERROR_WINDOW_MS);
      globalDiagnosticsCollector.addEvent(diag.summarize(200));

      return ok({ notification, fromCache });
    } finally {
      releaseSlot();
    }
  } catch (err) {
    // Try to get address for error tracking (may not have succeeded in auth)
    try {
      const authHeader = req.headers.get('authorization');
      const address = requireWalletAuth(authHeader);
      errorRateTracker.recordError(address, NOTIFICATION_BOUNDS.ERROR_WINDOW_MS);
      const threshold = NOTIFICATION_BOUNDS.ERROR_RATE_THRESHOLD;
      const opened = errorRateTracker.checkAndOpenCircuit(
        address,
        threshold,
        NOTIFICATION_BOUNDS.ERROR_WINDOW_MS,
      );
      if (opened) {
        const diag = new OperationDiagnostics('PATCH', address, traceId);
        diag.warn(`Circuit breaker opened (error rate >= ${threshold}%)`);
        globalDiagnosticsCollector.addEvent(diag.summarize(undefined, true));
      }
    } catch {
      // Auth failed, skip tracking
    }
    throw err;
  }
});
