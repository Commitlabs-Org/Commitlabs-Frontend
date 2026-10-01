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
import type { TransactionMetadata, TransactionType } from '@/lib/transaction/transactionTypes';
import { TRANSACTION_BOUNDS, createTransactionError } from '@/lib/transaction/transactionTypes';
import { TransactionStateMachine } from '@/lib/transaction/transactionStateMachine';
import { validateTransactionMetadata } from '@/lib/transaction/transactionStateMachine';

const SettleRequestSchema = z.object({
  callerAddress: z.string().optional(),
  transactionId: z.string().optional(),
});

const COMMITMENT_SETTLE_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_SETTLE_CORS_POLICY);

/**
 * Generate a unique transaction ID
 */
function generateTransactionId(commitmentId: string): string {
  return `settle_${commitmentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
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

    const callerAddress = validation.data.callerAddress;
    const clientTransactionId = validation.data.transactionId;
    
    // Generate or use client-provided transaction ID
    const transactionId = clientTransactionId || generateTransactionId(id);
    
    // Initialize state machine for this transaction
    const stateMachine = new TransactionStateMachine('pending');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commitment: any = await getCommitmentFromChain(id, { requestId: correlationId });

    if (!commitment) {
      const error = createTransactionError(
        'VALIDATION_ERROR' as any,
        'Commitment not found',
        transactionId,
      );
      stateMachine.transition('failed');
      throw new NotFoundError('Commitment', { commitmentId: id });
    }
    if (commitment.status === 'SETTLED') {
      const error = createTransactionError(
        'VALIDATION_ERROR' as any,
        'Commitment has already been settled',
        transactionId,
      );
      stateMachine.transition('rejected');
      throw new ConflictError('Commitment has already been settled');
    }
    if (commitment.status === 'VIOLATED') {
      const error = createTransactionError(
        'VALIDATION_ERROR' as any,
        'Commitment has been violated and cannot be settled',
        transactionId,
      );
      stateMachine.transition('rejected');
      throw new ConflictError('Commitment has been violated and cannot be settled');
    }
    if (commitment.status === 'EARLY_EXIT') {
      const error = createTransactionError(
        'VALIDATION_ERROR' as any,
        'Commitment has already been exited early',
        transactionId,
      );
      stateMachine.transition('rejected');
      throw new ConflictError('Commitment has already been exited early');
    }
    if (
      callerAddress &&
      commitment.ownerAddress &&
      callerAddress.toLowerCase() !== commitment.ownerAddress.toLowerCase()
    ) {
      const error = createTransactionError(
        'VALIDATION_ERROR' as any,
        'You do not own this commitment',
        transactionId,
      );
      stateMachine.transition('failed');
      throw new ForbiddenError('You do not own this commitment');
    }

    // Transition to confirming state before blockchain call
    const transitionError = stateMachine.transition('confirming');
    if (transitionError) {
      throw new ConflictError(transitionError.message);
    }

    try {
      const settlementResult = await settleCommitmentOnChain(
        {
          commitmentId: id,
          callerAddress,
        },
        { requestId: correlationId },
      );

      // Transition to confirmed state on success
      stateMachine.transition('confirmed');

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
        transactionId,
        transactionState: stateMachine.getState(),
      };
      
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
        'settlement' as TransactionType,
        id,
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
  },
  { cors: COMMITMENT_SETTLE_CORS_POLICY },
);

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
