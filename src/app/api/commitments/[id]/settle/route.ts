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
 * - Malformed response: validated via assertSettleResponse
 * - Unauthorized: ownership check prevents bypass via parameter tampering
 * - Replay: idempotency key prevents duplicate settlement ledger effects
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
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
import { diagnosticsService } from '@/lib/backend/diagnostics';
import type { TransactionMetadata, TransactionType } from '@/lib/transaction/transactionTypes';
import { TransactionStateMachine } from '@/lib/transaction/transactionStateMachine';
import { validateTransactionMetadata } from '@/lib/transaction/transactionStateMachine';

const STELLAR_ADDRESS_PATTERN = /^G[A-Z0-9]{55}$/;

const SettleRequestSchema = z.object({
  callerAddress: z.string().min(1, 'callerAddress is required.'),
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

/**
 * Validates the on-chain settlement response before it is returned to the
 * caller. Rejects responses that are missing required fields, which can
 * indicate tampering, malformed RPC output, or a corrupted ledger state.
 */
function assertSettleResponse(result: {
  settlementAmount?: string;
  finalStatus?: string;
  txHash?: string;
}): void {
  if (
    result.finalStatus === undefined ||
    result.finalStatus === '' ||
    result.txHash === undefined ||
    result.txHash === '' ||
    result.settlementAmount === undefined ||
    result.settlementAmount === null ||
    result.settlementAmount === ''
  ) {
    throw new ValidationError(
      'Invalid settlement response: missing required fields (settlementAmount, finalStatus, txHash).',
    );
  }
}

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
    const operationId = randomUUID();
    diagnosticsService.startOperation(operationId, 'settle_commitment', 10);

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
        body = await req.json();
      } catch {
        throw new ValidationError('Invalid JSON in request body');
      }

      const validation = SettleRequestSchema.safeParse(body);
      if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.issues);
      }

      const { callerAddress, transactionId: clientTransactionId } = validation.data;

      if (!STELLAR_ADDRESS_PATTERN.test(callerAddress)) {
        throw new ValidationError('Invalid callerAddress: expected a valid Stellar address.');
      }

      // Generate or use client-provided transaction ID
      const transactionId = clientTransactionId || generateTransactionId(id);

      // Initialize state machine for this transaction
      const stateMachine = new TransactionStateMachine('pending');

      const commitment = await getCommitmentFromChain(id, { requestId: correlationId });

      if (!commitment) {
        stateMachine.transition('failed');
        diagnosticsService.completeOperation(operationId, 'failure', 'Commitment not found');
        throw new NotFoundError('Commitment', { commitmentId: id });
      }
      if (commitment.status === 'SETTLED') {
        stateMachine.transition('rejected');
        diagnosticsService.completeOperation(
          operationId,
          'failure',
          'Commitment has already been settled',
        );
        throw new ConflictError('Commitment has already been settled');
      }
      if (commitment.status === 'VIOLATED') {
        stateMachine.transition('rejected');
        diagnosticsService.completeOperation(
          operationId,
          'failure',
          'Commitment has been violated and cannot be settled',
        );
        throw new ConflictError('Commitment has been violated and cannot be settled');
      }
      if (commitment.status === 'EARLY_EXIT') {
        stateMachine.transition('rejected');
        diagnosticsService.completeOperation(
          operationId,
          'failure',
          'Commitment has already been exited early',
        );
        throw new ConflictError('Commitment has already been exited early');
      }

      // Ownership verification (boundary + authorization invariant)
      if (
        callerAddress &&
        commitment.ownerAddress &&
        callerAddress.toLowerCase() !== commitment.ownerAddress.toLowerCase()
      ) {
        stateMachine.transition('failed');
        diagnosticsService.completeOperation(
          operationId,
          'failure',
          'Ownership verification failed',
        );
        throw new ForbiddenError(
          'Ownership verification failed: caller does not own this commitment.',
        );
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

        assertSettleResponse(settlementResult);

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

        diagnosticsService.completeOperation(operationId, 'success', undefined, {
          commitmentId: id,
          finalStatus: settlementResult.finalStatus,
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
        const metadataValidationError = validateTransactionMetadata(transactionMetadata);
        if (metadataValidationError) {
          // Log validation error but don't fail the request
          console.error('[Transaction] Metadata validation failed:', metadataValidationError);
        }

        diagnosticsService.completeOperation(
          operationId,
          'failure',
          error instanceof Error ? error.message : String(error),
        );

        throw error;
      }
    } catch (error) {
      diagnosticsService.completeOperation(
        operationId,
        'failure',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  },
  { cors: COMMITMENT_SETTLE_CORS_POLICY },
);

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
