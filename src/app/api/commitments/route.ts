import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { ForbiddenError, TooManyRequestsError, ValidationError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { parseJsonWithLimit, JSON_BODY_LIMITS } from '@/lib/backend/jsonBodyLimit';
import { logInfo, logWarn } from '@/lib/backend/logger';
import { MAX_PAGE_SIZE } from '@/lib/backend/pagination';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import { requireAuth, verifyAuth } from '@/lib/backend/requireAuth';
import { getBackendConfig } from '@/lib/backend/config';
import {
  getUserCommitmentsFromChain,
  createCommitmentOnChain,
} from '@/lib/backend/services/contracts';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

const CommitmentsQuerySchema = z.object({
  ownerAddress: z
    .string()
    .regex(STELLAR_ADDRESS_RE, 'ownerAddress must be a valid Stellar public key (G..., 56 chars)'),
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

const CreateCommitmentSchema = z.object({
  ownerAddress: z
    .string()
    .regex(STELLAR_ADDRESS_RE, 'ownerAddress must be a valid Stellar public key (G..., 56 chars)'),
  asset: z.string().min(1, 'asset is required'),
  amount: z
    .string()
    .refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && Number.isFinite(num) && num > 0;
      },
      { message: 'amount must be a finite positive number string' },
    ),
  durationDays: z.number().int().min(1, 'durationDays must be a positive integer'),
  maxLossBps: z.number().int().min(0).max(10000, 'maxLossBps must be between 0 and 10000'),
  network: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const COMMITMENTS_CORS_POLICY = {
  GET: { access: 'first-party' },
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENTS_CORS_POLICY);

export const GET = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
    const startedAt = Date.now();

    // Authorization before any query parsing or chain work: a request with
    // no valid session is rejected immediately.
    const authenticatedReq = requireAuth(req);
    const sessionAddress = authenticatedReq.user.address;

    const { searchParams } = new URL(req.url);
    const queryResult = CommitmentsQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    if (!queryResult.success) {
      throw new ValidationError('Invalid query parameters', queryResult.error.issues);
    }

    const { ownerAddress, page, pageSize, status, type, minCompliance } = queryResult.data;

    // Enforce ownership: session address must match requested ownerAddress
    if (ownerAddress !== sessionAddress) {
      throw new ForbiddenError(
        'ownerAddress in query does not match the authenticated session identity',
        { requestedOwner: ownerAddress, sessionOwner: sessionAddress },
      );
    }

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

    let mapped = sourceCommitments.map((c: any) => ({
      commitmentId: String(c.id ?? c.commitmentId),
      ownerAddress: c.ownerAddress,
      asset: c.asset,
      amount: typeof c.amount === 'bigint' ? String(c.amount) : c.amount,
      status: c.status,
      complianceScore: c.complianceScore,
      type: 'Safe',
      currentValue: typeof c.currentValue === 'bigint' ? String(c.currentValue) : c.currentValue,
      feeEarned: c.feeEarned,
      violationCount: c.violationCount,
      createdAt: c.createdAt,
      expiresAt: c.expiresAt,
      contractVersion: c.contractVersion,
    }));

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

    const ip = getClientIp(req);
    // Use the dedicated write-route key so tighter limits apply
    if (!(await checkRateLimit(ip, 'api/commitments/create'))) {
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/commitments/create'),
      );
    }

    const parsed = await parseJsonWithLimit(req, {
      limitBytes: JSON_BODY_LIMITS.commitmentsCreate,
    });

    const validation = CreateCommitmentSchema.safeParse(parsed);
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues);
    }

    const { ownerAddress, asset, amount, durationDays, maxLossBps, network: clientNetwork, metadata } =
      validation.data;

    // Validate supported asset (XLM, USDC)
    const normalizedAsset = asset.toUpperCase();
    if (!['XLM', 'USDC'].includes(normalizedAsset)) {
      throw new ValidationError('Asset is not supported. Supported assets: XLM, USDC.');
    }

    // Network passphrase check if provided
    if (clientNetwork !== undefined) {
      const { networkPassphrase } = getBackendConfig();
      if (clientNetwork !== networkPassphrase) {
        throw new ValidationError(
          'Client network passphrase does not match server configuration',
          { expected: networkPassphrase, received: clientNetwork },
        );
      }
    }

    // Session authorization & owner address cross-check
    const auth = verifyAuth(req);
    const sessionAddress = auth.address;

    if (ownerAddress !== sessionAddress) {
      throw new ForbiddenError(
        'ownerAddress in request body does not match the authenticated session identity',
        { requestedOwner: ownerAddress, sessionOwner: sessionAddress },
      );
    }

    const result = await createCommitmentOnChain(
      {
        ownerAddress: sessionAddress,
        asset: normalizedAsset,
        amount,
        durationDays,
        maxLossBps,
        ...(metadata !== undefined ? { metadata } : {}),
      },
      { requestId: correlationId },
    );

    // Validate response shape from chain service
    if (!result || typeof result !== 'object') {
      throw new ValidationError('Chain service returned an invalid response structure');
    }

    return ok(result, undefined, 201, correlationId);
  },
  { cors: COMMITMENTS_CORS_POLICY },
);

const _405 = methodNotAllowed(['GET', 'POST']);
export { _405 as PUT, _405 as PATCH, _405 as DELETE };

