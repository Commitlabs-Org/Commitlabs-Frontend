import { NextRequest } from 'next/server'
import { z } from 'zod';
import { fail, ok, methodNotAllowed } from "@/lib/backend/apiResponse";
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { TooManyRequestsError, ValidationError } from "@/lib/backend/errors";
import { getClientIp } from '@/lib/backend/getClientIp';
import { parseJsonWithLimit, JSON_BODY_LIMITS } from "@/lib/backend/jsonBodyLimit";
import { checkRateLimit } from "@/lib/backend/rateLimit";
import { getUserCommitmentsFromChain, createCommitmentOnChain } from "@/lib/backend/services/contracts";
import { validateStellarAddress } from "@/lib/backend/validation";
import { withApiHandler } from "@/lib/backend/withApiHandler";

const CommitmentsQuerySchema = z.object({
  ownerAddress: z.string().min(1, "ownerAddress is required"),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  status: z.enum(['ACTIVE', 'SETTLED', 'VIOLATED', 'EARLY_EXIT', 'UNKNOWN']).optional(),
  type: z.string().optional(),
  minCompliance: z.coerce.number().min(0).max(100).optional(),
});

interface CreateCommitmentRequestBody {
  ownerAddress: string;
  asset: string;
  amount: string;
  durationDays: number;
  maxLossBps: number;
  metadata?: Record<string, unknown>;
}

const COMMITMENTS_CORS_POLICY = {
  GET: { access: 'first-party' },
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENTS_CORS_POLICY);

export const GET = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  const { searchParams } = new URL(req.url);
  const queryResult = CommitmentsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!queryResult.success) {
    throw new ValidationError("Invalid query parameters", queryResult.error.issues);
  }

  const { ownerAddress, page, pageSize, status, type, minCompliance } = queryResult.data;
  const ip = getClientIp(req);
  if (!(await checkRateLimit(ip, "api/commitments"))) {
    throw new TooManyRequestsError();
  }

  const commitments = await getUserCommitmentsFromChain(ownerAddress);
  let mapped = commitments.map((c: any) => ({
    commitmentId: String(c.id ?? c.commitmentId),
    ownerAddress: c.ownerAddress,
    asset: c.asset,
    amount: typeof c.amount === 'bigint' ? String(c.amount) : c.amount,
    status: c.status,
    complianceScore: c.complianceScore,
    type: 'Safe',
    currentValue: typeof c.currentValue === "bigint" ? String(c.currentValue) : c.currentValue,
    feeEarned: c.feeEarned,
    violationCount: c.violationCount,
    createdAt: c.createdAt,
    expiresAt: c.expiresAt,
  }));

  if (status) mapped = mapped.filter((c) => c.status === status);
  if (type) mapped = mapped.filter((c) => c.type.toLowerCase() === type.toLowerCase());
  if (minCompliance !== undefined) mapped = mapped.filter((c) => c.complianceScore >= minCompliance);

  const total = mapped.length;
  const start = (page - 1) * pageSize;
  const items = mapped.slice(start, start + pageSize);

  return ok({ items, page, pageSize, total }, undefined, 200, correlationId);
}, { cors: COMMITMENTS_CORS_POLICY });

export const POST = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(ip, "api/commitments"))) {
    throw new TooManyRequestsError();
  }

  const parsed = await parseJsonWithLimit(req, {
    limitBytes: JSON_BODY_LIMITS.commitmentsCreate,
  });
  const body = (parsed ?? {}) as Partial<CreateCommitmentRequestBody>;
  const { ownerAddress, asset, amount, durationDays, maxLossBps, metadata } = body;

  if (!ownerAddress || typeof ownerAddress !== "string") {
    return fail("BAD_REQUEST", "Invalid ownerAddress", undefined, 400, correlationId);
  }
  try {
    validateStellarAddress(ownerAddress, "ownerAddress");
  } catch {
    return fail("BAD_REQUEST", "Invalid ownerAddress: must be a valid Stellar address (G... format).", undefined, 400, correlationId);
  }
  if (!asset || typeof asset !== "string") {
    return fail("BAD_REQUEST", "Invalid asset", undefined, 400, correlationId);
  }
  if (!amount || isNaN(Number(amount))) {
    return fail("BAD_REQUEST", "Invalid amount", undefined, 400, correlationId);
  }
  if (!durationDays || durationDays <= 0) {
    return fail("BAD_REQUEST", "Invalid durationDays", undefined, 400, correlationId);
  }
  if (maxLossBps == null || maxLossBps < 0) {
    return fail("BAD_REQUEST", "Invalid maxLossBps", undefined, 400, correlationId);
  }

  const result = await createCommitmentOnChain({
    ownerAddress,
    asset,
    amount,
    durationDays,
    maxLossBps,
    metadata,
  });

  return ok(result, undefined, 201, correlationId);
}, { cors: COMMITMENTS_CORS_POLICY });

const _405 = methodNotAllowed(['GET', 'POST']);
export { _405 as PUT, _405 as PATCH, _405 as DELETE };
