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
import { diagnosticsService } from '@/lib/backend/diagnostics';
import { randomUUID } from 'crypto';

const FundRequestSchema = z.object({
  callerAddress: z.string().min(1, 'callerAddress is required'),
});

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

const COMMITMENT_FUND_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_FUND_CORS_POLICY);

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
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

      const callerAddress = validation.data.callerAddress;

      // ─── Commitment State Check (Precondition Invariant) ───────────────────────
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
      const funded = await fundEscrowOnChain({
        commitmentId: id,
        callerAddress,
      });

      // Capture fundedAt once so the idempotency cache stores the exact
      // same timestamp that is returned in the response body — a retry with
      // the same Idempotency-Key will replay this stable value.
      const fundedAt = new Date().toISOString();

      // ─── Success Response & Idempotency Caching ───────────────────────────────
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
