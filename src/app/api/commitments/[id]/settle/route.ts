/**
 * POST /api/commitments/[id]/settle
 *
 * ## Authorization & State Invariants
 *
 * Settlement is a transaction-producing action with strict authorization boundaries:
 *
 * ### Authorization Checks (Boundary Layer)
 * 1. CSRF token validation (prevents request forgery)
 * 2. Route parameter validation (commitment ID exists and is not empty)
 * 3. Commitment ownership verification (caller must be owner)
 * 4. State precondition check (only FUNDED/ACTIVE → SETTLED)
 * 5. Numeric amount bounds validation
 * 6. Transaction response validation (detect tampering/corruption)
 *
 * ### State Machine Invariants
 * - Only FUNDED or ACTIVE commitments can settle (precondition invariant)
 * - Settlement transitions state to SETTLED (postcondition invariant)
 * - Once SETTLED, cannot be unsettled or re-settled (idempotency)
 * - Amounts must be within numeric bounds (no overflow/underflow)
 *
 * ### Failure Modes
 * - Wrong network: detected via state inconsistency
 * - Malformed response: validated via validateTransactionResponse
 * - Unauthorized: ownership check prevents bypass via parameter tampering
 * - Replay: idempotency key prevents duplicate settlement ledger effects
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { getCommitmentFromChain, settleCommitmentOnChain } from '@/lib/backend/services/contracts';
import { logCommitmentSettled } from '@/lib/backend/logger';
import { idempotencyService } from '@/lib/backend/idempotency';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { idempotencyService } from '@/lib/backend/idempotency';
import { diagnosticsService } from '@/lib/backend/diagnostics';
import {
  verifyOwnership,
  verifyCanSettle,
  validateTransactionResponse,
  validateAddressBounds,
} from '@/lib/backend/transactionValidation';
import { randomUUID } from 'crypto';

const SettleRequestSchema = z.object({
  callerAddress: z.string(),
});

const COMMITMENT_SETTLE_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_SETTLE_CORS_POLICY);

export const POST = withApiHandler(async (req: NextRequest, { params }, correlationId) => {
  // Generate unique operation ID for diagnostics
  const operationId = randomUUID();
  const telemetry = diagnosticsService.startOperation(
    operationId,
    'settle_commitment',
    100, // max concurrent
  );
  try {
    // ─── CSRF Protection ──────────────────────────────────────────────────────
    assertMutationCsrf(req);

    // ─── Rate Limiting ────────────────────────────────────────────────────────
    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 'api/commitments/settle'))) {
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/commitments/settle'),
      );
    }

    // ─── Route Parameter Validation (Boundary Layer) ─────────────────────────
    const id = params.id;
    if (!id?.trim()) {
      throw new ValidationError('Commitment ID is required');
    }

    // ─── Idempotency Check & Protection ──────────────────────────────────────
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      const record = await idempotencyService.getRecord(idempotencyKey);
      if (record) {
        if (record.status === 'COMPLETED') {
          diagnosticsService.completeOperation(operationId, 'success', undefined, {
            cacheHit: true,
            idempotent: true,
          });
          const response = ok(record.response, undefined, record.statusCode, correlationId);
          response.headers.set('X-Idempotent-Replay', 'true');
          return response;
        } else if (record.status === 'STARTED') {
          throw new ConflictError(
            'A request with this Idempotency-Key is currently processing. Please retry after a brief delay.',
          );
        }
      }
      await idempotencyService.start(idempotencyKey);
    }
    // ─── Request Body Validation ──────────────────────────────────────────────
    let body: unknown;
    try {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw new ValidationError('Invalid JSON in request body');
      }

      const validation = SettleRequestSchema.safeParse(body);
      if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.issues);
      }

    // ─── Address Bounds Validation ────────────────────────────────────────────
    const callerAddress = validateAddressBounds(validation.data.callerAddress, 'callerAddress');

    // ─── Commitment State Check (Precondition Invariant) ───────────────────────
    const commitment: any = await getCommitmentFromChain(id, { requestId: correlationId });

    if (!commitment) {
      throw new NotFoundError('Commitment', { commitmentId: id });
    }

    // Verify commitment can be settled
    try {
      verifyCanSettle(commitment.status);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Cannot settle commitment';
      throw new ConflictError(errorMsg, { commitmentId: id, status: commitment.status });
    }

    // ─── Ownership Verification (Authorization Boundary) ──────────────────────
    try {
      verifyOwnership(callerAddress, commitment.ownerAddress);
    } catch (error) {
      diagnosticsService.completeOperation(
        operationId,
        'failure',
        'Authorization failed: ownership verification',
        { commitmentId: id, reason: 'ownership_mismatch' },
      );
      if (error instanceof ForbiddenError) {
        throw error;
      }
      throw new ForbiddenError('Ownership verification failed', { commitmentId: id });
    }

    // ─── Execute Settlement on Chain ──────────────────────────────────────────
    const settlementResult = await settleCommitmentOnChain(
      {
        commitmentId: id,
        callerAddress,
      },
      { requestId: correlationId },
    );

    // ─── Validate Transaction Response (Malformed Response Detection) ──────────
    validateTransactionResponse(settlementResult, 'settlement');

      logCommitmentSettled({
        ip,
        commitmentId: id,
        callerAddress,
        settlementAmount: settlementResult.settlementAmount,
        finalStatus: settlementResult.finalStatus,
        txHash: settlementResult.txHash,
      });

    const responseData = {
      commitmentId: id,
      settlementAmount: settlementResult.settlementAmount,
      finalStatus: settlementResult.finalStatus,
      txHash: settlementResult.txHash,
      reference: settlementResult.reference,
      settledAt: new Date().toISOString(),
    };

    if (idempotencyKey) {
      await idempotencyService.complete(idempotencyKey, responseData, 200);
    }

    diagnosticsService.completeOperation(
      operationId,
      'success',
      undefined,
      { commitmentId: id, txHash: settlementResult.txHash },
    );

    return ok(responseData, undefined, 200, correlationId);
  } catch (error) {
    // Clean up idempotency record on failure to allow retry
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      await idempotencyService.fail(idempotencyKey);
    }

    // Record failure in diagnostics
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during settlement';
    diagnosticsService.completeOperation(operationId, 'failure', errorMessage, {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    throw error;
  }
}, { cors: COMMITMENT_SETTLE_CORS_POLICY });

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
