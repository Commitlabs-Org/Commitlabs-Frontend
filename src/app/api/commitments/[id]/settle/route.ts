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

/** idempotency-key header name, shared with the early-exit mutation route. */
const IDEMPOTENCY_HEADER = 'idempotency-key';

const SettleRequestSchema = z.object({
  callerAddress: z.string().optional(),
});

const COMMITMENT_SETTLE_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_SETTLE_CORS_POLICY);

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
    assertMutationCsrf(req);

    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 'api/commitments/settle'))) {
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/commitments/settle'),
      );
    }

    const id = params.id;
    if (!id?.trim()) {
      throw new ValidationError('Commitment ID is required');
    }

    // Deduplicate retries with an optional idempotency key. Settlement is a
    // money-moving, potentially double-application action: a network retry after
    // a timeout must not settle the same commitment twice. Mirroring the
    // early-exit route, COMPLETED results are replayed verbatim, an in-flight
    // STARTED record conflicts, and any failure deletes the key so the client
    // can safely retry (recovery without silently repeating the on-chain action).
    const idempotencyKey = req.headers.get(IDEMPOTENCY_HEADER);
    if (idempotencyKey) {
      const record = await idempotencyService.getRecord(idempotencyKey);
      if (record) {
        if (record.status === 'COMPLETED') {
          return ok(record.response, undefined, record.statusCode, correlationId);
        }
        if (record.status === 'STARTED') {
          throw new ConflictError('A request with this Idempotency-Key is currently processing');
        }
      }
      // `start()` only succeeds once: if a concurrent request won the slot we
      // must not double-settle. Treating a `false` here as a conflict prevents
      // two racing requests from both submitting an on-chain settlement.
      if (!(await idempotencyService.start(idempotencyKey))) {
        throw new ConflictError('A request with this Idempotency-Key is currently processing');
      }
    }

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const commitment: any = await getCommitmentFromChain(id, { requestId: correlationId });

      if (!commitment) {
        throw new NotFoundError('Commitment', { commitmentId: id });
      }
      if (commitment.status === 'SETTLED') {
        throw new ConflictError('Commitment has already been settled');
      }
      if (commitment.status === 'VIOLATED') {
        throw new ConflictError('Commitment has been violated and cannot be settled');
      }
      if (commitment.status === 'EARLY_EXIT') {
        throw new ConflictError('Commitment has already been exited early');
      }
      if (
        callerAddress &&
        commitment.ownerAddress &&
        callerAddress.toLowerCase() !== commitment.ownerAddress.toLowerCase()
      ) {
        throw new ForbiddenError('You do not own this commitment');
      }

      const settlementResult = await settleCommitmentOnChain(
        {
          commitmentId: id,
          callerAddress,
        },
        { requestId: correlationId },
      );

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

      return ok(responseData, undefined, 200, correlationId);
    } catch (error) {
      // Release the in-flight marker so a subsequent retry can proceed. On the
      // wire this maps to a distinct error code before/after any on-chain write;
      // if the settle never left the server the client is safe to retry.
      if (idempotencyKey) {
        await idempotencyService.fail(idempotencyKey);
      }
      throw error;
    }
  },
  { cors: COMMITMENT_SETTLE_CORS_POLICY },
);

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
