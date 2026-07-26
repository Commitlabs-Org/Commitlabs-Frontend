import { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { ApiError, BackendError, ConflictError, TooManyRequestsError, ForbiddenError, ValidationError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { logEarlyExit } from '@/lib/backend/logger';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { idempotencyService } from '@/lib/backend/idempotency';
import { requireAuth } from '@/lib/backend/requireAuth';
import { EarlyExitRequestBodySchema } from '@/lib/schemas/apiContracts';
import { earlyExitCommitmentOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';

const COMMITMENT_EARLY_EXIT_CORS_POLICY = {
  POST: { access: "first-party" },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(
  COMMITMENT_EARLY_EXIT_CORS_POLICY,
);

function rethrowContractError(error: unknown): never {
  if (error instanceof BackendError) {
    throw new ApiError(error.message, error.code, error.status, error.details);
  }

  throw error;
}

export const POST = withApiHandler(async (req: NextRequest, { params }, correlationId) => {
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

    if (sessionAddress !== callerAddress) {
      throw new ForbiddenError(
        'You are not authorized to perform this action. Session address does not match caller address.',
      );
    }

    const commitment = await getCommitmentFromChain(commitmentId).catch(rethrowContractError);

    if (commitment.ownerAddress !== callerAddress) {
      throw new ForbiddenError(
        'You do not own this commitment and cannot exit it early.',
      );
    }

    const result = await earlyExitCommitmentOnChain({
      commitmentId,
      callerAddress,
    }).catch(rethrowContractError);

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

    return ok(responseData, undefined, 200, correlationId);
  } catch (error) {
    if (idempotencyKey) {
      await idempotencyService.fail(idempotencyKey);
    }
    throw error;
  }
}, { cors: COMMITMENT_EARLY_EXIT_CORS_POLICY });

const _405 = methodNotAllowed(["POST"]);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
