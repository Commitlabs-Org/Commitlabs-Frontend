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
import { requireAuth } from '@/lib/backend/requireAuth';
import { EarlyExitRequestBodySchema } from '@/lib/schemas/apiContracts';
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

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
    assertMutationCsrf(req);

    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 'api/commitments/early-exit'))) {
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/commitments/early-exit'),
      );
    }

    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
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

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
