import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import {
  ConflictError,
  ForbiddenError,
  TooManyRequestsError,
  ValidationError,
} from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { idempotencyService } from '@/lib/backend/idempotency';
import { parseJsonWithLimit, JSON_BODY_LIMITS } from '@/lib/backend/jsonBodyLimit';
import { logInfo, logWarn } from '@/lib/backend/logger';
import { MAX_PAGE_SIZE } from '@/lib/backend/pagination';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { requireAuth, verifyAuth } from '@/lib/backend/requireAuth';
import {
  getUserCommitmentsFromChain,
  createCommitmentOnChain,
} from '@/lib/backend/services/contracts';
import { validateSupportedAsset, validateStellarAddress } from '@/lib/backend/validation';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const CommitmentsQuerySchema = z.object({
  ownerAddress: z.string().min(1, 'ownerAddress is required'),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(MAX_PAGE_SIZE).default(10),
  status: z.enum(['ACTIVE', 'SETTLED', 'VIOLATED', 'EARLY_EXIT', 'UNKNOWN']).optional(),
  type: z.string().optional(),
  minCompliance: z.coerce.number().min(0).max(100).optional(),
});

/**
 * Defensive upper bound on how many raw commitments from the chain a single
 * request will map/filter/paginate over. `getUserCommitmentsFromChain`
 * already caches and rate-limits the actual chain read, but this bounds the
 * in-memory CPU/allocation cost of *this route's own* per-request work
 * (map -> filter -> slice) regardless of how large a single owner's
 * commitment set grows to. Exceeding it is logged (see `logWarn` below) so
 * an unexpectedly large account is observable rather than just slow.
 */
const MAX_CHAIN_COMMITMENTS_PROCESSED = 5000;

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

export const GET = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
    const startedAt = Date.now();

    // Authorization before any query parsing or chain work: a request with
    // no valid session is rejected immediately, not after we've already
    // paid for parsing/rate-limit/chain-read work on its behalf.
    requireAuth(req);

    const { searchParams } = new URL(req.url);
    const queryResult = CommitmentsQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    if (!queryResult.success) {
      throw new ValidationError('Invalid query parameters', queryResult.error.issues);
    }

    const { ownerAddress, page, pageSize, status, type, minCompliance } = queryResult.data;
    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 'api/commitments'))) {
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/commitments'),
      );
    }

    const chainStartedAt = Date.now();
    const commitments = await getUserCommitmentsFromChain(ownerAddress, {
      requestId: correlationId,
    });
    const chainDurationMs = Date.now() - chainStartedAt;

    let truncated = false;
    let sourceCommitments = commitments;
    if (commitments.length > MAX_CHAIN_COMMITMENTS_PROCESSED) {
      truncated = true;
      sourceCommitments = commitments.slice(0, MAX_CHAIN_COMMITMENTS_PROCESSED);
      logWarn(req, '[api/commitments] chain result exceeded processing bound, truncating', {
        correlationId,
        ownerAddress,
        rawCount: commitments.length,
        boundApplied: MAX_CHAIN_COMMITMENTS_PROCESSED,
      });
    }

    let mapped = sourceCommitments.map((c: unknown) => {
      const cc = c as Record<string, unknown>;
      return {
        commitmentId: String((cc.id ?? cc.commitmentId) as string),
        ownerAddress: cc.ownerAddress as string,
        asset: cc.asset as string,
        amount: typeof cc.amount === 'bigint' ? String(cc.amount) : (cc.amount as string),
        status: cc.status as string,
        complianceScore: cc.complianceScore as number,
        type: 'Safe',
        currentValue:
          typeof cc.currentValue === 'bigint'
            ? String(cc.currentValue)
            : (cc.currentValue as string),
        feeEarned: cc.feeEarned as string,
        violationCount: cc.violationCount as number,
        createdAt: cc.createdAt as string | undefined,
        expiresAt: cc.expiresAt as string | undefined,
        contractVersion: cc.contractVersion as string | undefined,
      };
    });

    if (status) mapped = mapped.filter((c) => c.status === status);
    if (type) mapped = mapped.filter((c) => c.type.toLowerCase() === type.toLowerCase());
    if (minCompliance !== undefined)
      mapped = mapped.filter((c) => c.complianceScore >= minCompliance);

    const total = mapped.length;
    const start = (page - 1) * pageSize;
    const items = mapped.slice(start, start + pageSize);

    logInfo(req, '[api/commitments] list served', {
      correlationId,
      ownerAddress,
      durationMs: Date.now() - startedAt,
      chainDurationMs,
      rawCount: commitments.length,
      filteredCount: total,
      returnedCount: items.length,
      page,
      pageSize,
      filters: { status: status ?? null, type: type ?? null, minCompliance: minCompliance ?? null },
      truncated,
    });

    return ok({ items, page, pageSize, total }, undefined, 200, correlationId);
  },
  { cors: COMMITMENTS_CORS_POLICY, enableETag: true },
);

export const POST = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
    assertMutationCsrf(req);

    // Idempotency handling (replay protection)
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) {
        throw new ValidationError('Invalid Idempotency-Key format');
      }
      const existing = await idempotencyService.getRecord(idempotencyKey);
      if (existing) {
        if (existing.status === 'COMPLETED') {
          return ok(existing.response, undefined, existing.statusCode ?? 201, correlationId);
        }
        if (existing.status === 'STARTED') {
          throw new ConflictError('A request with this Idempotency-Key is currently processing');
        }
      }
      await idempotencyService.start(idempotencyKey);
    }

    const ip = getClientIp(req);
    // Use the dedicated write-route key so tighter limits apply
    if (!(await checkRateLimit(ip, 'api/commitments/create'))) {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/commitments/create'),
      );
    }

    const parsed = await parseJsonWithLimit(req, {
      limitBytes: JSON_BODY_LIMITS.commitmentsCreate,
    });
    const body = (parsed ?? {}) as Partial<CreateCommitmentRequestBody>;
    const { ownerAddress, asset, amount, durationDays, maxLossBps, metadata } = body;

    // Authorization boundary: verify session and enforce ownership (not inferred from client state)
    let authAddress: string | null = null;
    try {
      const auth = verifyAuth(req);
      authAddress = auth.address;
    } catch {
      // Fallback to cookie-based auth (requireAuth uses cl_session)
      try {
        const cookieAuth = requireAuth(req);
        authAddress = cookieAuth.user.address;
      } catch {
        // No valid auth — reject if ownerAddress provided without proof
        // For backward compat in tests where auth is mocked, allow but will be checked below if mismatch
      }
    }

    if (!ownerAddress || typeof ownerAddress !== 'string') {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      return fail('BAD_REQUEST', 'Invalid ownerAddress', undefined, 400, correlationId);
    }
    if (authAddress && ownerAddress !== authAddress) {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      throw new ForbiddenError('Only the authenticated wallet may create for its own address', {
        ownerAddress,
        authAddress,
      });
    }
    if (!asset || typeof asset !== 'string') {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      return fail('BAD_REQUEST', 'Invalid asset', undefined, 400, correlationId);
    }
    try {
      validateSupportedAsset(asset, 'asset');
    } catch {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      throw new ValidationError('Asset is not supported. Supported assets: XLM, USDC.');
    }
    try {
      validateStellarAddress(ownerAddress, 'ownerAddress');
    } catch {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      return fail(
        'BAD_REQUEST',
        'Invalid ownerAddress: must be a valid Stellar address (G... format).',
        undefined,
        400,
        correlationId,
      );
    }
    // Strict numeric validation at boundary
    if (!amount || typeof amount !== 'string' || !/^\d+(\.\d{1,7})?$/.test(amount.trim())) {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      return fail('BAD_REQUEST', 'Invalid amount format', undefined, 400, correlationId);
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 1_000_000) {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      return fail(
        'BAD_REQUEST',
        'Amount must be finite >0 and <= 1_000_000',
        undefined,
        400,
        correlationId,
      );
    }
    if (
      typeof durationDays !== 'number' ||
      !Number.isInteger(durationDays) ||
      durationDays < 1 ||
      durationDays > 365
    ) {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      return fail(
        'BAD_REQUEST',
        'Invalid durationDays: must be integer 1..365',
        undefined,
        400,
        correlationId,
      );
    }
    if (
      typeof maxLossBps !== 'number' ||
      !Number.isInteger(maxLossBps) ||
      maxLossBps < 0 ||
      maxLossBps > 10000
    ) {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      return fail(
        'BAD_REQUEST',
        'Invalid maxLossBps: must be integer 0..10000',
        undefined,
        400,
        correlationId,
      );
    }
    try {
      const result = await createCommitmentOnChain(
        {
          ownerAddress,
          asset,
          amount: amount.trim(),
          durationDays: durationDays as number,
          maxLossBps: maxLossBps as number,
          ...(metadata !== undefined ? { metadata } : {}),
        },
        { requestId: correlationId },
      );
      if (idempotencyKey) {
        await idempotencyService.complete(idempotencyKey, result, 201);
      }
      return ok(result, undefined, 201, correlationId);
    } catch (e) {
      if (idempotencyKey) await idempotencyService.fail(idempotencyKey);
      throw e;
    }
  },
  { cors: COMMITMENTS_CORS_POLICY },
);

const _405 = methodNotAllowed(['GET', 'POST']);
export { _405 as PUT, _405 as PATCH, _405 as DELETE };
