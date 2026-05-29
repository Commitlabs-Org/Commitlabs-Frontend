import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { ConflictError, NotFoundError, TooManyRequestsError, ValidationError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { getCommitmentFromChain, settleCommitmentOnChain } from '@/lib/backend/services/contracts';
import { logCommitmentSettled } from '@/lib/backend/logger';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { idempotencyService } from '@/lib/backend/idempotency';

const SettleRequestSchema = z.object({
  callerAddress: z.string().optional(),
});

const COMMITMENT_SETTLE_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_SETTLE_CORS_POLICY);

export const POST = withApiHandler(async (req: NextRequest, { params }, correlationId) => {
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

  const settlementResult = await settleCommitmentOnChain({
    commitmentId: id,
    callerAddress,
  }, { requestId: correlationId });

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
    }, { requestId: correlationId },
    undefined,
    200,
    correlationId,
  );
}, { cors: COMMITMENT_SETTLE_CORS_POLICY });

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };