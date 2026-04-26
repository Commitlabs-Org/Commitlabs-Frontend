import { NextRequest } from 'next/server'
import { z } from 'zod';
import { checkRateLimit } from "@/lib/backend/rateLimit";
import { withApiHandler } from "@/lib/backend/withApiHandler";
import { ok, fail } from "@/lib/backend/apiResponse";
import { TooManyRequestsError } from "@/lib/backend/errors";
import { parseJsonWithLimit, JSON_BODY_LIMITS } from "@/lib/backend/jsonBodyLimit";
import { getUserCommitmentsFromChain, createCommitmentOnChain } from "@/lib/backend/services/contracts";

// Query validation schema
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


export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  
  // Validate query parameters using Zod
  const queryResult = CommitmentsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  
  if (!queryResult.success) {
    throw new ValidationError("Invalid query parameters", queryResult.error.errors);
  }

  const { ownerAddress, page, pageSize, status, type, minCompliance } = queryResult.data;

  const ip = req.ip ?? req.headers.get("x-forwarded-for") ?? "anonymous";

  const isAllowed = await checkRateLimit(ip, "api/commitments");
  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const commitments = await getUserCommitmentsFromChain(ownerAddress);

  // Map and add derived/placeholder fields if needed
  let mapped = commitments.map((c) => ({
    commitmentId: String(c.id),
    ownerAddress:  c.ownerAddress,
    asset: c.asset,
    amount: typeof c.amount === "bigint" ? String(c.amount) : c.amount,
    status: c.status,
    complianceScore: c.complianceScore,
    // Note: 'type' is not natively on chain, using a placeholder or metadata if available
    type: 'Safe', // Placeholder: in a real app, this would be derived or stored in metadata
    currentValue:
      typeof c.currentValue === "bigint"
        ? c.currentValue
        : c.currentValue,
    feeEarned: c.feeEarned,
    violationCount: c.violationCount,
    createdAt: c.createdAt,
    expiresAt: c.expiresAt,
  }));

  // Apply Filters
  if (status) {
    mapped = mapped.filter(c => c.status === status);
  }

  if (type) {
    mapped = mapped.filter(c => c.type.toLowerCase() === type.toLowerCase());
  }

  if (minCompliance !== undefined) {
    mapped = mapped.filter(c => c.complianceScore >= minCompliance);
  }

  // Apply Pagination
  const total = mapped.length;
  const start = (page - 1) * pageSize;
  const items = mapped.slice(start, start + pageSize);

  return ok({
    items,
    page,
    pageSize,
    total,
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const ip = req.ip ?? req.headers.get("x-forwarded-for") ?? "anonymous";

  const isAllowed = await checkRateLimit(ip, "api/commitments");
  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const parsed = await parseJsonWithLimit(req, {
    limitBytes: JSON_BODY_LIMITS.commitmentsCreate,
  });
  const body = (parsed ?? {}) as Partial<CreateCommitmentRequestBody>;

  const {
    ownerAddress,
    asset,
    amount,
    durationDays,
    maxLossBps,
    metadata,
  } = body;

  // Basic validation
  if (!ownerAddress || typeof ownerAddress !== "string") {
    return fail("Invalid ownerAddress", "BAD_REQUEST", 400);
  }

  if (!asset || typeof asset !== "string") {
    return fail("Invalid asset", "BAD_REQUEST", 400);
  }

  if (!amount || isNaN(Number(amount))) {
    return fail("Invalid amount", "BAD_REQUEST", 400);
  }

  if (!durationDays || durationDays <= 0) {
    return fail("Invalid durationDays", "BAD_REQUEST", 400);
  }

  if (maxLossBps == null || maxLossBps < 0) {
    return fail("Invalid maxLossBps", "BAD_REQUEST", 400);
  }

  // Call chain interaction
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
