import { NextRequest } from 'next/server';
import { ok } from '@/lib/backend/apiResponse';
import { ApiError, BackendError, NotFoundError, TooManyRequestsError } from '@/lib/backend/errors';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { getClientIp } from '@/lib/backend/getClientIp';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';

/**
 * GET /api/commitments/[id]/settle/preview
 *
 * Returns a preview of whether a commitment is eligible for settlement and an estimated settlement amount.
 * Reuses the maturity and status checks from the settlement logic without mutating chain state.
 */
export const GET = withApiHandler(async (req: NextRequest, { params }, correlationId) => {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(ip, 'api/commitments/settle/preview'))) {
    throw new TooManyRequestsError(
      'Too many requests. Please try again later.',
      undefined,
      getRateLimitWindowSeconds('api/commitments/settle/preview'),
    );
  }

  const commitmentId = params.id;
  if (!commitmentId?.trim()) {
    throw new NotFoundError('Commitment');
  }

  let commitment;
  try {
    commitment = await getCommitmentFromChain(commitmentId, { requestId: correlationId });
  } catch (error) {
    if (error instanceof BackendError) {
      throw new ApiError(error.message, error.code, error.status, error.details);
    }
    throw error;
  }

  if (!commitment) {
    throw new NotFoundError('Commitment', { commitmentId });
  }

  let maturity = true;
  let maturityReason: string | null = null;
  if (commitment.expiresAt) {
    const expiryTime = new Date(commitment.expiresAt).getTime();
    const now = Date.now();
    if (now < expiryTime) {
      maturity = false;
      maturityReason = 'Commitment has not matured yet and cannot be settled.';
    }
  }

  let noDispute = true;
  let disputeReason: string | null = null;
  if (commitment.status === 'DISPUTED') {
    noDispute = false;
    disputeReason = 'Commitment is currently in dispute and cannot be settled.';
  }

  let eligibleState = true;
  let stateReason: string | null = null;
  if (commitment.status === 'SETTLED') {
    eligibleState = false;
    stateReason = 'Commitment has already been settled.';
  } else if (commitment.status === 'VIOLATED') {
    eligibleState = false;
    stateReason = 'Commitment has been violated and cannot be settled.';
  } else if (commitment.status === 'EARLY_EXIT') {
    eligibleState = false;
    stateReason = 'Commitment has already been exited early.';
  } else if (commitment.status === 'CREATED') {
    eligibleState = false;
    stateReason = 'Commitment must be active to be settled.';
  } else if (commitment.status !== 'ACTIVE' && commitment.status !== 'DISPUTED') {
    eligibleState = false;
    stateReason = 'Commitment is in an ineligible state for settlement.';
  }

  const eligible = maturity && noDispute && eligibleState;
  let reason: string | null = null;
  if (!eligibleState) {
    reason = stateReason;
  } else if (!noDispute) {
    reason = disputeReason;
  } else if (!maturity) {
    reason = maturityReason;
  }

  const responseData = {
    eligible,
    reason,
    estimatedSettlement: commitment.currentValue,
    criteria: {
      maturity,
      noDispute,
      eligibleState,
    },
  };

  return ok(responseData, undefined, 200, correlationId);
});
