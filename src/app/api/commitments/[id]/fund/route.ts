import { NextRequest, NextResponse } from 'next/server';
/**
 * POST /api/commitments/[id]/fund
 *
 * ## Idempotency & State Invariants
 *
 * Funding requests are strictly idempotent: repeated requests with the same
 * Idempotency-Key return the same response without creating duplicate ledger effects.
 *
 * ### State Machine Invariants
 * - Only CREATED commitments can be funded (precondition invariant)
 * - Funding transitions state to FUNDED (postcondition invariant)
 * - No state regression: state never reverts from FUNDED to CREATED
 * - Ownership is immutable: only ownerAddress can fund
 *
 * ### Concurrent Request Bounds
 * - Max 100 concurrent funding operations per route
 * - Exceeding bound returns 503 with degraded telemetry
 * - Individual caller rate limit: per IP (from global rate limiter)
 *
 * ### Retry & Recovery
 * - STARTED idempotency records block concurrent retries (prevent duplicate txs)
 * - COMPLETED records are cached for 24 hours (default TTL)
 * - FAILED records are deleted (allow immediate retry)
 * - Network failures expose via X-Telemetry-Status header
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import {
  BackendError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
  toBackendErrorResponse,
} from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { fundEscrowOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { idempotencyService } from '@/lib/backend/idempotency';
<<<<<<< HEAD
import { diagnosticsService } from '@/lib/backend/diagnostics';
import { randomUUID } from 'crypto';
=======
import { verifyAuth } from '@/lib/backend/requireAuth';
import { getBackendConfig } from '@/lib/backend/config';
>>>>>>> c0494997 ([#1762] Improve funding route idempotency: authorization and hostile-input boundary)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Stellar public keys are always exactly 56 characters and begin with 'G'.
 * This regex rejects obviously-malformed addresses before they reach the chain
 * service, preventing tampered or placeholder values from being forwarded.
 */
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

/**
 * Maximum byte length for an idempotency key.  Unbounded keys could be used
 * to inflate in-memory/KV storage without meaningful semantic value.
 */
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Body schema for POST /api/commitments/[id]/fund.
 *
 * `callerAddress` is optional here: when omitted the route falls back to the
 * address extracted from the verified server-side session token.  When
 * provided it must be a syntactically-valid Stellar public key; the route
 * then additionally checks it matches the session identity, preventing a
 * client from spoofing a different owner address.
 *
 * `network` is optional: when supplied by the client it must equal the
 * server-configured network passphrase, catching wrong-network submissions
 * before any on-chain call is attempted.
 */
const FundRequestSchema = z.object({
  callerAddress: z
    .string()
    .regex(STELLAR_ADDRESS_RE, 'callerAddress must be a valid Stellar public key (G…, 56 chars)')
    .optional(),
  network: z.string().optional(),
});

<<<<<<< HEAD
/**
 * Bound for concurrent funding operations.
 * Prevents resource exhaustion during high load or DDoS.
 * Monitor via diagnosticsService.getOperationStats('fund').maxConcurrentOps
 */
const MAX_CONCURRENT_FUNDING_OPS = 100;

/**
 * Maximum duration for fund operation before considered slow/degraded.
 * Used for SLO tracking and alerting in production.
 */
const FUND_OPERATION_SLOW_THRESHOLD_MS = 30000; // 30 seconds
=======
// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
>>>>>>> c0494997 ([#1762] Improve funding route idempotency: authorization and hostile-input boundary)

const COMMITMENT_FUND_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_FUND_CORS_POLICY);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
<<<<<<< HEAD
    // Generate unique operation ID for telemetry tracking
    const operationId = randomUUID();

    // Start operation telemetry (includes concurrent ops tracking)
    const telemetry = diagnosticsService.startOperation(
      operationId,
      'fund_commitment',
      MAX_CONCURRENT_FUNDING_OPS,
    );

    // Check if we're at capacity
    if (telemetry.status === 'degraded') {
      diagnosticsService.completeOperation(operationId, 'degraded', telemetry.failureReason);
      const response = new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Funding service temporarily degraded. Too many concurrent requests.',
            requestId: correlationId,
          },
        }),
        { status: 503 },
      );
      response.headers.set('X-Telemetry-Status', 'degraded');
      return response;
    }

    try {
      assertMutationCsrf(req);

      const ip = getClientIp(req);
      if (!(await checkRateLimit(ip, 'api/commitments/fund'))) {
        throw new TooManyRequestsError(
          'Too many requests. Please try again later.',
          undefined,
          getRateLimitWindowSeconds('api/commitments/fund'),
        );
      }

      const id = params.id;
      if (!id?.trim()) {
        throw new ValidationError('Commitment ID is required');
      }

      // ─── Idempotency Check & Protection ────────────────────────────────────
      // Ensures repeated requests with same key don't create duplicate funding txs
      const idempotencyKey = req.headers.get('idempotency-key');
      let isIdempotentRetry = false;

      if (idempotencyKey) {
        const record = await idempotencyService.getRecord(idempotencyKey);
        if (record) {
          isIdempotentRetry = true;
          if (record.status === 'COMPLETED') {
            // Cache hit - return saved response immediately
            diagnosticsService.completeOperation(operationId, 'success', undefined, {
              cacheHit: true,
              idempotent: true,
            });
            const response = ok(record.response, undefined, record.statusCode, correlationId);
            response.headers.set('X-Idempotent-Replay', 'true');
            return response;
          } else if (record.status === 'STARTED') {
            // Another request with same key is in progress - block to prevent duplicates
            diagnosticsService.completeOperation(
              operationId,
              'degraded',
              'Concurrent idempotent request already processing',
              { idempotencyKey },
            );
            throw new ConflictError(
              'A request with this Idempotency-Key is currently processing. Please retry after a brief delay.',
            );
          }
        }
        // Begin tracking this idempotency key
        await idempotencyService.start(idempotencyKey);
      }

      // ─── Request Validation ───────────────────────────────────────────────────
=======
    // --- CSRF -----------------------------------------------------------------
    assertMutationCsrf(req);

    // --- Rate limit -----------------------------------------------------------
    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 'api/commitments/fund'))) {
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/commitments/fund'),
      );
    }

    // --- Route parameter validation -------------------------------------------
    const id = params.id;
    if (!id?.trim()) {
      throw new ValidationError('Commitment ID is required');
    }

    // --- Idempotency key validation --------------------------------------------
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey !== null) {
      if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
        throw new ValidationError(
          `Idempotency-Key must not exceed ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
        );
      }
      const record = await idempotencyService.getRecord(idempotencyKey);
      if (record) {
        if (record.status === 'COMPLETED') {
          return ok(record.response, undefined, record.statusCode, correlationId);
        } else if (record.status === 'STARTED') {
          throw new ConflictError('A request with this Idempotency-Key is currently processing');
        }
      }
      await idempotencyService.start(idempotencyKey);
    }

    try {
      // --- Body parsing -------------------------------------------------------
>>>>>>> c0494997 ([#1762] Improve funding route idempotency: authorization and hostile-input boundary)
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw new ValidationError('Invalid JSON in request body');
      }

      const validation = FundRequestSchema.safeParse(body);
      if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.issues);
      }

<<<<<<< HEAD
      const callerAddress = validation.data.callerAddress;

      // ─── Commitment State Check (Precondition Invariant) ───────────────────────
=======
      const { callerAddress: bodyAddress, network: clientNetwork } = validation.data;

      // --- Network passphrase check -------------------------------------------
      // When the client supplies a `network` hint we verify it matches the
      // server-configured passphrase.  A mismatch indicates a wrong-network
      // wallet or a tampered payload; reject early rather than broadcasting a
      // transaction to the wrong network.
      if (clientNetwork !== undefined) {
        const { networkPassphrase } = getBackendConfig();
        if (clientNetwork !== networkPassphrase) {
          throw new ValidationError(
            'Client network passphrase does not match server configuration',
            { expected: networkPassphrase, received: clientNetwork },
          );
        }
      }

      // --- Session-based authorization ----------------------------------------
      // Derive the authenticated wallet identity from the server-side session
      // token (Bearer header or session cookie).  We do NOT rely solely on the
      // client-supplied callerAddress to establish identity — a tampered body
      // would otherwise allow any address to be asserted as the caller.
      //
      // When the client also supplies callerAddress we cross-check it against
      // the session identity.  This ensures both:
      //   1. The session is valid (not disconnected or expired).
      //   2. The body address has not been tampered to impersonate a different owner.
      const auth = verifyAuth(req);
      const sessionAddress = auth.address;

      if (bodyAddress !== undefined && bodyAddress !== sessionAddress) {
        throw new ForbiddenError(
          'callerAddress in request body does not match the authenticated session identity',
          { commitmentId: id },
        );
      }

      // Resolved caller: prefer the session-verified address.
      const callerAddress = sessionAddress;

      // --- Commitment state validation ----------------------------------------
>>>>>>> c0494997 ([#1762] Improve funding route idempotency: authorization and hostile-input boundary)
      const commitment = await getCommitmentFromChain(id);

      if (!commitment) {
        throw new NotFoundError('Commitment', { commitmentId: id });
      }

      // INVARIANT: Only CREATED commitments can transition to FUNDED
      if (commitment.status !== 'CREATED') {
        const statusError = new ConflictError(
          `Cannot fund commitment in ${commitment.status} state. Only CREATED commitments can be funded.`,
          { commitmentId: id, currentStatus: commitment.status },
        );
        diagnosticsService.completeOperation(
          operationId,
          'failure',
          `Invalid state: ${commitment.status}`,
          { commitmentId: id },
        );
        throw statusError;
      }

<<<<<<< HEAD
      // INVARIANT: Ownership immutability - only owner can fund
      if (callerAddress && callerAddress !== commitment.ownerAddress) {
        const authError = new ForbiddenError(
          'Only the commitment owner may fund this commitment',
          { commitmentId: id },
        );
        diagnosticsService.completeOperation(
          operationId,
          'failure',
          'Authorization failed: caller is not owner',
          { commitmentId: id },
        );
        throw authError;
      }

      // ─── Execute Funding on Chain ──────────────────────────────────────────────
      // This is the critical operation - any failure here should not create ledger effects
=======
      // --- Ownership check (server-side) --------------------------------------
      // Ownership is verified against the on-chain record, not inferred from
      // client state.  The session address must match the ownerAddress stored
      // on-chain; a mismatch means replay/tampering with another user's ID.
      if (callerAddress !== commitment.ownerAddress) {
        throw new ForbiddenError('Only the commitment owner may fund this commitment', {
          commitmentId: id,
        });
      }

      // --- Numeric commitment amount sanity check -----------------------------
      // `commitment.amount` is a string from the chain.  Validate it is a
      // finite, positive number before proceeding; a malformed chain response
      // (zero, NaN, negative) would silently create a bogus funding record.
      const numericAmount = Number(commitment.amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new ValidationError('Commitment amount from chain is invalid or non-positive', {
          amount: commitment.amount,
          commitmentId: id,
        });
      }

      // --- On-chain funding ---------------------------------------------------
>>>>>>> c0494997 ([#1762] Improve funding route idempotency: authorization and hostile-input boundary)
      const funded = await fundEscrowOnChain({
        commitmentId: id,
        callerAddress,
      });

<<<<<<< HEAD
      // Capture fundedAt once so the idempotency cache stores the exact
      // same timestamp that is returned in the response body — a retry with
      // the same Idempotency-Key will replay this stable value.
      const fundedAt = new Date().toISOString();

      // ─── Success Response & Idempotency Caching ───────────────────────────────
=======
      // --- Server response shape validation -----------------------------------
      // Validate that the chain service returned a structurally-sound response
      // before we persist the idempotency record and return it to the client.
      // A missing txHash is acceptable (mock / dry-run mode returns undefined),
      // but the commitmentId echo must match to prevent a confused-deputy bug.
      if (funded.commitmentId !== id) {
        throw new ValidationError('Chain service returned mismatched commitmentId', {
          expected: id,
          received: funded.commitmentId,
        });
      }
      if (funded.txHash !== undefined && typeof funded.txHash !== 'string') {
        throw new ValidationError('Chain service returned invalid txHash type');
      }

>>>>>>> c0494997 ([#1762] Improve funding route idempotency: authorization and hostile-input boundary)
      const responseData = {
        commitmentId: id,
        txHash: funded.txHash,
        reference: funded.reference,
        fundedAt,
      };

      if (idempotencyKey) {
        await idempotencyService.complete(idempotencyKey, responseData, 200);
      }

      const duration = Date.now() - telemetry.startTime;
      const isSlow = duration > FUND_OPERATION_SLOW_THRESHOLD_MS;

      diagnosticsService.completeOperation(
        operationId,
        isSlow ? 'degraded' : 'success',
        undefined,
        {
          duration,
          idempotent: isIdempotentRetry,
          slow: isSlow,
          txHash: funded.txHash,
        },
      );

      const response = ok(responseData, undefined, 200, correlationId);
      if (isSlow) {
        response.headers.set('X-Telemetry-Status', 'slow');
      }
      return response;
    } catch (error) {
      // Clean up idempotency record on failure to allow retry
      const idempotencyKey = req.headers.get('idempotency-key');
      if (idempotencyKey) {
        await idempotencyService.fail(idempotencyKey);
      }
      // BackendError is thrown by the contracts layer (e.g. blockchain 502).
      // It is not an ApiError, so withApiHandler would otherwise swallow
      // the status code and return 500. Return the structured error response
      // directly so callers receive the correct HTTP status (e.g. 502).
      if (error instanceof BackendError) {
        return NextResponse.json(toBackendErrorResponse(error), { status: error.status });
      }

      // Record failure in diagnostics for observability
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during funding operation';
      diagnosticsService.completeOperation(operationId, 'failure', errorMessage, {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });

      throw error;
    }
  },
  { cors: COMMITMENT_FUND_CORS_POLICY },
);

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
