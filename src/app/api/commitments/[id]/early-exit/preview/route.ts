import { NextRequest } from 'next/server';
import { ok } from '@/lib/backend/apiResponse';
import { BackendError, BackendErrorCode } from '@/lib/backend/errors';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { getProtocolConstants, PenaltyTier } from '@/lib/backend/services/protocolConstants';

/**
 * GET /api/commitments/{id}/early-exit/preview
 *
 * Returns a preview of the early‑exit penalty for a specific commitment.
 * The calculation uses the penalty tiers defined in `protocolConstants.ts` and
 * the commitment data fetched from the blockchain.
 */
export const GET = withApiHandler(async (req: NextRequest, { params }) => {
  // Rate‑limit to protect the RPC endpoint.
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
  const allowed = await checkRateLimit(ip, 'api/commitments/early-exit/preview');
  if (!allowed) {
    throw new BackendError({
      code: BackendErrorCode.TOO_MANY_REQUESTS,
      message: 'Rate limit exceeded',
      status: 429,
    });
  }

  const commitmentId = params.id as string;
  if (!commitmentId) {
    throw new BackendError({
      code: BackendErrorCode.BAD_REQUEST,
      message: 'Missing commitment id',
      status: 400,
    });
  }

  // Fetch the commitment from the chain.
  const commitment = await getCommitmentFromChain(commitmentId).catch(() => {
    throw new BackendError({
      code: BackendErrorCode.NOT_FOUND,
      message: `Commitment ${commitmentId} not found`,
      status: 404,
    });
  });

  // Disallow preview for already settled commitments.
  if (commitment.status === 'SETTLED') {
    throw new BackendError({
      code: BackendErrorCode.CONFLICT,
      message: 'Commitment has already been settled',
      status: 409,
    });
  }

  // Determine the applicable penalty tier. If the commitment contains a `type`
  // field we use it, otherwise we fall back to the first tier (usually "safe").
  const protocol = getProtocolConstants();
  const tier: PenaltyTier = (commitment as any).type
    ? protocol.penalties.find((t) => t.type === (commitment as any).type) ?? protocol.penalties[0]
    : protocol.penalties[0];

  const principal = Number(commitment.amount);
  const penaltyPercent = tier.earlyExitPenaltyPercent;
  const penaltyAmount = +(principal * (penaltyPercent / 100)).toFixed(2);
  const netRefund = +(principal - penaltyAmount).toFixed(2);

  return ok({
    principal,
    penaltyPercent,
    penaltyAmount,
    netRefund,
  });
});
