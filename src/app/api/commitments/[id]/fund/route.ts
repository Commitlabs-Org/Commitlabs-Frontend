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
import { fundEscrowOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { idempotencyService } from '@/lib/backend/idempotency';

const FundRequestSchema = z.object({
  callerAddress: z.string().optional(),
});

const COMMITMENT_FUND_CORS_POLICY = {
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_FUND_CORS_POLICY);

export const POST = withApiHandler(
  async (req: NextRequest, { params }, correlationId) => {
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

      const validation = FundRequestSchema.safeParse(body);
      if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.issues);
      }

      const callerAddress = validation.data.callerAddress;
      const commitment = await getCommitmentFromChain(id);

      if (!commitment) {
        throw new NotFoundError('Commitment', { commitmentId: id });
      }

      if (commitment.status !== 'CREATED') {
        throw new ConflictError('Only created commitments can be funded');
      }

      if (callerAddress && callerAddress !== commitment.ownerAddress) {
        throw new ForbiddenError(
          'Only the commitment owner may fund this commitment',
          { commitmentId: id },
        );
      }

      const funded = await fundEscrowOnChain({
        commitmentId: id,
        callerAddress,
      });

      const responseData = {
        commitmentId: id,
        txHash: funded.txHash,
        reference: funded.reference,
        fundedAt: new Date().toISOString(),
      };

      if (idempotencyKey) {
        await idempotencyService.complete(idempotencyKey, responseData, 200);
      }

      return ok(responseData, undefined, 200, correlationId);
    } catch (error) {
      if (idempotencyKey) {
        await idempotencyService.fail(idempotencyKey);
      }
      throw error;
    }
  },
  { cors: COMMITMENT_FUND_CORS_POLICY },
);

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
