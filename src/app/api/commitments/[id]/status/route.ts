import { NextRequest } from 'next/server';
import { ok } from '@/lib/backend/apiResponse';
import { NotFoundError, TooManyRequestsError } from '@/lib/backend/errors';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';

/**
 * Lightweight commitment status response for efficient polling.
 * Returns only the fields needed to track commitment health
 * without fetching the full commitment payload.
 */
export interface CommitmentStatusResponse {
  commitmentId: string;
  status: string;
  daysRemaining: number;
  complianceScore: number;
  currentValue: string;
  violationCount: number;
  expiresAt: string | null;
}

/**
 * Calculate the number of days remaining until a commitment expires.
 * Returns 0 if the commitment has already expired.
 */
export function getDaysRemaining(expiresAt?: string): number {
  if (!expiresAt) return 0;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (isNaN(expiresAtMs)) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAtMs - Date.now()) / msPerDay));
}

/**
 * GET /api/commitments/[id]/status
 *
 * Returns a lightweight status snapshot for a commitment.
 * Designed for efficient polling — returns only the fields needed
 * to track commitment health without the full payload.
 *
 * @returns 200 with CommitmentStatusResponse
 * @returns 404 if commitment not found
 * @returns 429 if rate limit exceeded
 */
export const GET = withApiHandler(async (
  req: NextRequest,
  context: { params: Record<string, string> },
) => {
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
  const isAllowed = await checkRateLimit(ip, 'api/commitments/status');
  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const commitmentId = context.params.id;

  if (!commitmentId) {
    throw new NotFoundError('Commitment');
  }

  let commitment;
  try {
    commitment = await getCommitmentFromChain(commitmentId);
  } catch {
    throw new NotFoundError('Commitment', { commitmentId });
  }

  if (!commitment) {
    throw new NotFoundError('Commitment', { commitmentId });
  }

  const response: CommitmentStatusResponse = {
    commitmentId: commitment.id,
    status: commitment.status,
    daysRemaining: getDaysRemaining(commitment.expiresAt),
    complianceScore: commitment.complianceScore,
    currentValue: commitment.currentValue,
    violationCount: commitment.violationCount,
    expiresAt: commitment.expiresAt ?? null,
  };

  return ok(response);
});