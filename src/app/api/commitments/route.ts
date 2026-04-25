import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, fail } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getUserCommitmentsFromChain, createCommitmentOnChain } from '@/lib/backend/services/contracts';

/**
 * GET /api/commitments
 * Returns a paginated list of user commitments for a given owner address.
 * Auth: public read-only endpoint with rate limiting.
 * Query params:
 *   - ownerAddress: required account identifier
 *   - page: optional page number; default is 1
 *   - pageSize: optional page size; default is 10
 * Response:
 *   - items: paged commitment objects
 *   - page, pageSize, total: pagination contract fields
 *   - amount and currentValue are normalized as strings for bigint compatibility
 * Error codes:
 *   - BAD_REQUEST: missing or invalid params
 */

interface CreateCommitmentRequestBody {
  ownerAddress: string;
  asset: string;
  amount: string;
  durationDays: number;
  maxLossBps: number;
  metadata?: Record<string, unknown>;
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const ownerAddress = searchParams.get('ownerAddress');
  const page = Number(searchParams.get('page') ?? 1);
  const pageSize = Number(searchParams.get('pageSize') ?? 10);

  if (!ownerAddress) {
    return fail('BAD_REQUEST', 'Missing ownerAddress', undefined, 400);
  }

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return fail('BAD_REQUEST', 'Invalid pagination params', undefined, 400);
  }

  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

  const isAllowed = await checkRateLimit(ip, 'api/commitments');
  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const commitments = await getUserCommitmentsFromChain(ownerAddress);

  const mapped = commitments.map((c) => ({
    commitmentId: String(c.id),
    ownerAddress: c.ownerAddress,
    asset: c.asset,
    amount: typeof c.amount === 'bigint' ? String(c.amount) : c.amount,
    status: c.status,
    complianceScore: c.complianceScore,
    currentValue: typeof c.currentValue === 'bigint' ? String(c.currentValue) : c.currentValue,
    feeEarned: c.feeEarned,
    violationCount: c.violationCount,
    createdAt: c.createdAt,
    expiresAt: c.expiresAt,
  }));

  const start = (page - 1) * pageSize;
  const items = mapped.slice(start, start + pageSize);

  return ok({
    items,
    page,
    pageSize,
    total: mapped.length,
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

  const isAllowed = await checkRateLimit(ip, 'api/commitments');
  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const body = (await req.json()) as CreateCommitmentRequestBody;

  const {
    ownerAddress,
    asset,
    amount,
    durationDays,
    maxLossBps,
    metadata,
  } = body;

  if (!ownerAddress || typeof ownerAddress !== 'string') {
    return fail('BAD_REQUEST', 'Invalid ownerAddress', undefined, 400);
  }

  if (!asset || typeof asset !== 'string') {
    return fail('BAD_REQUEST', 'Invalid asset', undefined, 400);
  }

  if (!amount || isNaN(Number(amount))) {
    return fail('BAD_REQUEST', 'Invalid amount', undefined, 400);
  }

  if (!durationDays || durationDays <= 0) {
    return fail('BAD_REQUEST', 'Invalid durationDays', undefined, 400);
  }

  if (maxLossBps == null || maxLossBps < 0) {
    return fail('BAD_REQUEST', 'Invalid maxLossBps', undefined, 400);
  }

  const result = await createCommitmentOnChain({
    ownerAddress,
    asset,
    amount,
    durationDays,
    maxLossBps,
    metadata,
  });

  return ok(result, 201);
});
