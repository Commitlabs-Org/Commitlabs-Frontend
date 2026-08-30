/**
 * POST /api/commitments/[id]/early-exit
 *
 * ## Authorization & State Invariants
 *
 * Early exit is a transaction-producing action with strict authorization boundaries:
 *
 * ### Authorization Checks (Boundary Layer)
 * 1. CSRF token validation (prevents request forgery)
 * 2. Authentication requirement (session must be valid)
 * 3. Route parameter validation (commitment ID exists and is not empty)
 * 4. Session-wallet consistency (authenticated session must match caller wallet)
 * 5. Commitment ownership verification (caller must be owner)
 * 6. State precondition check (only FUNDED/ACTIVE → EARLY_EXIT)
 * 7. Numeric amount bounds validation
 * 8. Transaction response validation (detect tampering/corruption)
 *
 * ### State Machine Invariants
 * - Only FUNDED or ACTIVE commitments can exit early (precondition invariant)
 * - Early exit transitions state to EARLY_EXIT (postcondition invariant)
 * - Once exited early, cannot be re-exited or settled (idempotency)
 * - Amounts must be within numeric bounds (no overflow/underflow)
 * - Exit reason is required and bounded (max 500 chars)
 *
 * ### Hostile Input Scenarios
 * - Replay: idempotency key prevents duplicate exit ledger effects
 * - Tampering: numeric bounds and response validation detect corruption
 * - Wrong network: detected via state inconsistency
 * - Disconnected wallet: detected via requireAuth, session validation
 * - Wrong wallet: caught by session-wallet consistency check
 */

import { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import {
  ApiError,
  BackendError,
  ConflictError,
  TooManyRequestsError,
  ForbiddenError,
  ValidationError,
} from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { logEarlyExit } from '@/lib/backend/logger';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { idempotencyService } from '@/lib/backend/idempotency';
import { diagnosticsService } from '@/lib/backend/diagnostics';
import { requireAuth } from '@/lib/backend/requireAuth';
import { EarlyExitRequestBodySchema } from '@/lib/schemas/apiContracts';
import { earlyExitCommitmentOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';
import {
  earlyExitCommitmentOnChain,
  getCommitmentFromChain,
} from '@/lib/backend/services/contracts';
import type { TransactionMetadata, TransactionType } from '@/lib/transaction/transactionTypes';
import { TRANSACTION_BOUNDS, createTransactionError } from '@/lib/transaction/transactionTypes';
import { TransactionStateMachine } from '@/lib/transaction/transactionStateMachine';
import { validateTransactionMetadata } from '@/lib/transaction/transactionStateMachine';

const COMMITMENT_EARLY_EXIT_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_EARLY_EXIT_CORS_POLICY);

/**
 * Generate a unique transaction ID
 */
function generateTransactionId(commitmentId: string): string {
  return `early_exit_${commitmentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function rethrowContractError(error: unknown): never {
  if (error instanceof BackendError) {
    throw new ApiError(error.message, error.code, error.status, error.details);
  }

  throw error;
}

export const POST = withApiHandler(async (req: NextRequest, { params }, correlationId) => {
  // Generate unique operation ID for diagnostics
  const operationId = randomUUID();
  const telemetry = diagnosticsService.startOperation(
    operationId,
    'early_exit_commitment',
    100, // max concurrent
  );

  try {
    // ─── CSRF Protection ──────────────────────────────────────────────────────
    assertMutationCsrf(req);

    // ─── Rate Limiting ────────────────────────────────────────────────────────
    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 'api/commitments/early-exit'))) {
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/commitments/early-exit'),
      );
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

    // ─── Authentication ───────────────────────────────────────────────────────
    // Verifies session validity and extracts authenticated wallet address
    const authReq = requireAuth(req);
    const sessionAddress = authReq.user.address;

    // ─── Request Body Validation ──────────────────────────────────────────────
    let body: unknown;
    try {
      // Authentication
      const authReq = requireAuth(req);
      const sessionAddress = authReq.user.address;

      // Request body validation
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw new ValidationError('Request body must be valid JSON');
      }

      const parseResult = EarlyExitRequestBodySchema.safeParse(body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid request body', {
          errors: parseResult.error.flatten(),
        });
      }

      const { reason, callerAddress } = parseResult.data;
      const commitmentId = params.id;

      if (!commitmentId?.trim()) {
        throw new ValidationError('Commitment ID is required');
      }

      if (sessionAddress !== callerAddress) {
        throw new ForbiddenError(
          'You are not authorized to perform this action. Session address does not match caller address.',
        );
      }

      // Generate transaction ID
      const transactionId = generateTransactionId(commitmentId);
      
      // Initialize state machine for this transaction
      const stateMachine = new TransactionStateMachine('pending');

      const commitment = await getCommitmentFromChain(commitmentId).catch(rethrowContractError);

      if (commitment.ownerAddress !== callerAddress) {
        const error = createTransactionError(
          'VALIDATION_ERROR' as any,
          'You do not own this commitment and cannot exit it early.',
          transactionId,
        );
        stateMachine.transition('failed');
        throw new ForbiddenError('You do not own this commitment and cannot exit it early.');
      }

      // Transition to confirming state before blockchain call
      const transitionError = stateMachine.transition('confirming');
      if (transitionError) {
        throw new ConflictError(transitionError.message);
      }

      try {
        const result = await earlyExitCommitmentOnChain({
          commitmentId,
          callerAddress,
        }).catch(rethrowContractError);

        // Transition to confirmed state on success
        stateMachine.transition('confirmed');

        logEarlyExit({
          ip,
          commitmentId,
          callerAddress,
          reason,
          exitAmount: result.exitAmount,
          penaltyAmount: result.penaltyAmount,
        });

        const responseData = {
          exitAmount: result.exitAmount,
          penaltyAmount: result.penaltyAmount,
          finalStatus: result.finalStatus,
          txHash: result.txHash,
          reference: result.reference,
          transactionId,
          transactionState: stateMachine.getState(),
        };

        if (idempotencyKey) {
          await idempotencyService.complete(idempotencyKey, responseData, 200);
        }

        return ok(responseData, undefined, 200, correlationId);
      } catch (error) {
        // Transition to failed state on error
        stateMachine.transition('failed');
        
        // Create transaction metadata for error tracking
        const additionalFields: Partial<TransactionMetadata> = {
          callerAddress,
          error: error instanceof Error ? error.message : String(error),
        };
        
        const transactionMetadata: TransactionMetadata = stateMachine.toMetadata(
          transactionId,
          'early_exit' as TransactionType,
          commitmentId,
          additionalFields,
        );
        
        // Validate metadata invariants
        const validationError = validateTransactionMetadata(transactionMetadata);
        if (validationError) {
          // Log validation error but don't fail the request
          console.error('[Transaction] Metadata validation failed:', validationError);
        }
        
        throw error;
      }
    } catch (error) {
      if (idempotencyKey) {
        await idempotencyService.fail(idempotencyKey);
      }
      throw error;
    }
  },
  { cors: COMMITMENT_EARLY_EXIT_CORS_POLICY },
);

    const { reason, callerAddress } = parseResult.data;
    const commitmentId = params.id;

    if (!commitmentId?.trim()) {
      throw new ValidationError('Commitment ID is required');
    }

    // ─── Session-Wallet Consistency (Wrong-Wallet Detection) ─────────────────
    try {
      verifySessionConsistency(sessionAddress, callerAddress);
    } catch (error) {
      diagnosticsService.completeOperation(
        operationId,
        'failure',
        'Authorization failed: session-wallet mismatch',
        { commitmentId, reason: 'session_wallet_mismatch' },
      );
      if (error instanceof ForbiddenError) {
        throw error;
      }
      throw new ForbiddenError('Session authentication failed');
    }

    // ─── Commitment State Check (Precondition Invariant) ───────────────────────
    const commitment = await getCommitmentFromChain(commitmentId).catch(rethrowContractError);

    if (!commitment) {
      throw new Error(`Commitment not found: ${commitmentId}`);
    }

    // Verify commitment can be exited early
    try {
      verifyCanEarlyExit(commitment.status);
    } catch (error) {
      diagnosticsService.completeOperation(
        operationId,
        'failure',
        `Cannot early exit: ${error instanceof Error ? error.message : 'unknown'}`,
        { commitmentId, status: commitment.status },
      );
      throw new ConflictError(
        error instanceof Error ? error.message : 'Cannot exit commitment in current state',
        { commitmentId, status: commitment.status },
      );
    }

    // ─── Ownership Verification (Authorization Boundary) ──────────────────────
    try {
      verifyOwnership(callerAddress, commitment.ownerAddress);
    } catch (error) {
      diagnosticsService.completeOperation(
        operationId,
        'failure',
        'Authorization failed: ownership verification',
        { commitmentId, reason: 'ownership_mismatch' },
      );
      if (error instanceof ForbiddenError) {
        throw error;
      }
      throw new ForbiddenError('Ownership verification failed', { commitmentId });
    }

    // ─── Execute Early Exit on Chain ──────────────────────────────────────────
    const result = await earlyExitCommitmentOnChain({
      commitmentId,
      callerAddress,
    }).catch(rethrowContractError);

    // ─── Validate Transaction Response (Malformed Response Detection) ──────────
    validateTransactionResponse(result, 'early_exit');

    logEarlyExit({
      ip,
      commitmentId,
      callerAddress,
      reason,
      exitAmount: result.exitAmount,
      penaltyAmount: result.penaltyAmount,
    });

    const responseData = {
      exitAmount: result.exitAmount,
      penaltyAmount: result.penaltyAmount,
      finalStatus: result.finalStatus,
      txHash: result.txHash,
      reference: result.reference,
    };

    if (idempotencyKey) {
      await idempotencyService.complete(idempotencyKey, responseData, 200);
    }

    diagnosticsService.completeOperation(
      operationId,
      'success',
      undefined,
      { commitmentId, txHash: result.txHash },
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
      error instanceof Error ? error.message : 'Unknown error during early exit';
    diagnosticsService.completeOperation(operationId, 'failure', errorMessage, {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    throw error;
  }
}, { cors: COMMITMENT_EARLY_EXIT_CORS_POLICY });

const _405 = methodNotAllowed(["POST"]);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
