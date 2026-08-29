// src/app/api/commitments/search/route.ts
//
// Commitment search endpoint with rich filtering by asset, status, and risk type.
// Uses Zod validation, pagination.ts utilities for stable sorting/paging, and
// a short-TTL cache for common queries.

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { ForbiddenError, TooManyRequestsError, ValidationError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { logInfo, logWarn } from '@/lib/backend/logger';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { requireAuth } from '@/lib/backend/requireAuth';
import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';
import type { ChainCommitmentStatus } from '@/lib/backend/services/contracts';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import {
  parsePaginationParams,
  parseSortParams,
  paginateArray,
  paginationErrorResponse,
  PaginationParseError,
  type SortOrder,
} from '@/lib/backend/pagination';
import { cache } from '@/lib/backend/cache/factory';
import { CacheKey, CacheTTL } from '@/lib/backend/cache/index';
import { createHash } from 'crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Defensive upper bound on how many raw commitments a single search
 * request will filter/sort/paginate over in memory. See the identical
 * constant and rationale in `../route.ts`.
 */
const MAX_CHAIN_COMMITMENTS_PROCESSED = 5000;

/**
 * Allowed `CommitmentStatus` filter values.
 * Maps user-facing values to the on-chain `ChainCommitmentStatus` type.
 */
const COMMITMENT_STATUS_VALUES = [
  'CREATED',
  'ACTIVE',
  'SETTLED',
  'VIOLATED',
  'EARLY_EXIT',
] as const;
type CommitmentStatusFilter = (typeof COMMITMENT_STATUS_VALUES)[number];

/** Risk type filter – mirrors `CommitmentType` from domain types. */
const RISK_TYPE_VALUES = ['Safe', 'Balanced', 'Aggressive'] as const;
type RiskTypeFilter = (typeof RISK_TYPE_VALUES)[number];

/** Fields available for `sortBy`. */
const SORTABLE_FIELDS = ['createdAt', 'amount', 'complianceScore', 'status', 'asset'] as const;
type SortableField = (typeof SORTABLE_FIELDS)[number];

// ─── Zod validation schema ───────────────────────────────────────────────────

const trimmedOptionalString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const CommitmentSearchQuerySchema = z.object({
  /** Owner address – required to scope the search. */
  ownerAddress: z.string().trim().min(1, 'ownerAddress is required'),

  /** Filter by asset code (e.g. "XLM", "USDC"). Case-insensitive match. */
  asset: trimmedOptionalString,

  /** Free-text search by commitment ID. Case-insensitive substring match. */
  commitmentId: trimmedOptionalString,

  /**
   * Filter by commitment status.
   * Accepted values: CREATED, ACTIVE, SETTLED, VIOLATED, EARLY_EXIT.
   */
  status: z.enum(COMMITMENT_STATUS_VALUES).optional(),

  /**
   * Filter by risk type.
   * Accepted values: Safe, Balanced, Aggressive.
   */
  riskType: z.enum(RISK_TYPE_VALUES).optional(),

  /** Minimum compliance score (0–100). */
  minCompliance: z.coerce.number().min(0).max(100).optional(),

  // Pagination params are parsed separately by pagination.ts utilities,
  // but we accept them in the same query string.
  page: z.coerce.number().min(1).default(1).optional(),
  pageSize: z.coerce.number().min(1).max(100).default(10).optional(),

  // Sorting params are also parsed separately.
  sortBy: z.string().optional(),
  sortOrder: z.string().optional(),
});

// ─── Mapped search result shape ───────────────────────────────────────────────

export interface CommitmentSearchItem {
  commitmentId: string;
  ownerAddress: string;
  asset: string;
  amount: string;
  status: ChainCommitmentStatus;
  riskType: string;
  complianceScore: number;
  currentValue: string;
  feeEarned: string;
  violationCount: number;
  createdAt: string;
  expiresAt: string;
}

interface SearchInvariants {
  authorizedOwner: true;
  stableSort: true;
  boundedPage: true;
  duplicateCommitmentsRemoved: true;
}

interface SearchSnapshot {
  queryKey: string;
  generatedAt: string;
  source: 'cache' | 'chain';
  rawCount: number;
  processedCount: number;
  rejectedRecords: number;
  duplicateRecords: number;
  truncated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Infer a risk type from the commitment's `maxLossBps`-like fields.
 * Since the chain model doesn't carry an explicit risk type, we derive it
 * from compliance score and violation count as a heuristic.
 *
 * In the existing GET /api/commitments route, all commitments default to "Safe".
 * Here we keep the same default for consistency until the contract adds a type field.
 */
function inferRiskType(_commitment: Record<string, unknown>): string {
  return 'Safe';
}

/**
 * Deterministic cache key for a given search query.
 * Hashes the normalised filter parameters to avoid key collisions.
 */
function buildSearchCacheKey(
  ownerAddress: string,
  filters: Record<string, string | number | undefined>,
): string {
  const orderedFilters = Object.keys(filters)
    .sort()
    .reduce<Record<string, string | number | undefined>>((acc, key) => {
      acc[key] = filters[key];
      return acc;
    }, {});
  const payload = JSON.stringify({ ownerAddress, ...orderedFilters });
  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 16);
  return CacheKey.commitmentSearch(hash);
}

function normalizeAddress(address: string): string {
  return address.trim().toUpperCase();
}

function parseFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSearchItem(raw: any): CommitmentSearchItem | null {
  const commitmentId = String(raw.id ?? raw.commitmentId ?? '').trim();
  const ownerAddress = String(raw.ownerAddress ?? '').trim();
  const asset = String(raw.asset ?? '').trim();
  const amount = parseFiniteNumber(raw.amount);
  const complianceScore = parseFiniteNumber(raw.complianceScore);
  const violationCount = parseFiniteNumber(raw.violationCount);

  if (
    !commitmentId ||
    !ownerAddress ||
    !asset ||
    amount < 0 ||
    complianceScore < 0 ||
    complianceScore > 100 ||
    violationCount < 0 ||
    !Number.isInteger(violationCount)
  ) {
    return null;
  }

  return {
    commitmentId,
    ownerAddress,
    asset,
    amount: String(amount),
    status: raw.status as ChainCommitmentStatus,
    riskType: inferRiskType(raw),
    complianceScore,
    currentValue: String(parseFiniteNumber(raw.currentValue)),
    feeEarned: String(parseFiniteNumber(raw.feeEarned)),
    violationCount,
    createdAt: raw.createdAt ?? new Date(0).toISOString(),
    expiresAt: raw.expiresAt ?? new Date(0).toISOString(),
  };
}

function dedupeByCommitmentId(items: CommitmentSearchItem[]): {
  items: CommitmentSearchItem[];
  duplicateRecords: number;
} {
  const seen = new Set<string>();
  const deduped: CommitmentSearchItem[] = [];

  for (const item of items) {
    const key = item.commitmentId.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return { items: deduped, duplicateRecords: items.length - deduped.length };
}

/**
 * Compare two commitment items by the given field and order.
 * Provides a **stable** sort by using `commitmentId` as a tiebreaker.
 */
function compareItems(
  a: CommitmentSearchItem,
  b: CommitmentSearchItem,
  field: SortableField,
  order: SortOrder,
): number {
  const dir = order === 'asc' ? 1 : -1;

  let cmp: number;
  switch (field) {
    case 'amount': {
      cmp = Number(a.amount) - Number(b.amount);
      break;
    }
    case 'complianceScore': {
      cmp = a.complianceScore - b.complianceScore;
      break;
    }
    case 'createdAt': {
      const dateA = new Date(a.createdAt).getTime() || 0;
      const dateB = new Date(b.createdAt).getTime() || 0;
      cmp = dateA - dateB;
      break;
    }
    case 'status': {
      cmp = a.status.localeCompare(b.status);
      break;
    }
    case 'asset': {
      cmp = a.asset.localeCompare(b.asset);
      break;
    }
    default:
      cmp = 0;
  }

  // Stable tiebreaker
  if (cmp === 0) {
    cmp = a.commitmentId.localeCompare(b.commitmentId);
  }

  return cmp * dir;
}

// ─── CORS policy ──────────────────────────────────────────────────────────────

const SEARCH_CORS_POLICY = {
  GET: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(SEARCH_CORS_POLICY);

// ─── GET handler ──────────────────────────────────────────────────────────────

export const GET = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
    const startedAt = Date.now();

    // Authorization before any query parsing, cache lookup, or chain work.
    const authenticatedReq = requireAuth(req);

    // 1. Rate limit
    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 'api/commitments/search'))) {
      throw new TooManyRequestsError();
    }

    // 2. Parse & validate query params with Zod
    const { searchParams } = new URL(req.url);
    const rawQuery = Object.fromEntries(searchParams.entries());
    const queryResult = CommitmentSearchQuerySchema.safeParse(rawQuery);

    if (!queryResult.success) {
      throw new ValidationError('Invalid search parameters', queryResult.error.issues);
    }

    const { ownerAddress, asset, commitmentId, status, riskType, minCompliance } = queryResult.data;
    const normalizedOwnerAddress = normalizeAddress(ownerAddress);

    if (normalizeAddress(authenticatedReq.user.address) !== normalizedOwnerAddress) {
      throw new ForbiddenError('Cannot search commitments for another wallet');
    }

    // 3. Parse pagination & sort via pagination.ts helpers
    let paginationParams;
    let sortParams;
    try {
      paginationParams = parsePaginationParams(searchParams);
      sortParams = parseSortParams(searchParams, SORTABLE_FIELDS, 'createdAt', 'desc');
    } catch (err) {
      if (err instanceof PaginationParseError) {
        return paginationErrorResponse(err);
      }
      throw err;
    }

    // 4. Build cache key and check cache
    const cacheKey = buildSearchCacheKey(normalizedOwnerAddress, {
      asset: asset?.toUpperCase(),
      commitmentId: commitmentId?.toUpperCase(),
      status,
      riskType,
      minCompliance,
      sortBy: sortParams.sortBy,
      sortOrder: sortParams.sortOrder,
      page: paginationParams.page,
      pageSize: paginationParams.pageSize,
    });

    const cached = await cache.get<{
      data: CommitmentSearchItem[];
      meta: Record<string, unknown>;
      filters: Record<string, unknown>;
    }>(cacheKey);

    if (cached !== null) {
      logInfo(req, '[api/commitments/search] served from cache', {
        correlationId,
        ownerAddress: normalizedOwnerAddress,
        durationMs: Date.now() - startedAt,
        cacheHit: true,
      });
      return ok(
        {
          ...cached,
          snapshot: {
            ...(cached as { snapshot?: SearchSnapshot }).snapshot,
            source: 'cache',
          },
        },
        undefined,
        200,
        correlationId,
      );
    }

    // 5. Fetch from chain
    const chainStartedAt = Date.now();
    const commitments = await getUserCommitmentsFromChain(normalizedOwnerAddress);
    const chainDurationMs = Date.now() - chainStartedAt;

    let truncated = false;
    let sourceCommitments = commitments;
    if (commitments.length > MAX_CHAIN_COMMITMENTS_PROCESSED) {
      truncated = true;
      sourceCommitments = commitments.slice(0, MAX_CHAIN_COMMITMENTS_PROCESSED);
      logWarn(req, '[api/commitments/search] chain result exceeded processing bound, truncating', {
        correlationId,
        ownerAddress: normalizedOwnerAddress,
        rawCount: commitments.length,
        boundApplied: MAX_CHAIN_COMMITMENTS_PROCESSED,
      });
    }

    // 6. Map to search items
    const normalizedItems = sourceCommitments.map(normalizeSearchItem);
    const rejectedRecords = normalizedItems.filter((item) => item === null).length;
    const { items: dedupedItems, duplicateRecords } = dedupeByCommitmentId(
      normalizedItems.filter((item): item is CommitmentSearchItem => item !== null),
    );
    let items = dedupedItems;

    // 7. Apply filters
    if (asset) {
      const normalizedAsset = asset.toUpperCase();
      items = items.filter((c) => c.asset.toUpperCase() === normalizedAsset);
    }

    if (commitmentId) {
      const normalizedQuery = commitmentId.toUpperCase();
      items = items.filter((c) => c.commitmentId.toUpperCase().includes(normalizedQuery));
    }

    if (status) {
      items = items.filter((c) => c.status === status);
    }

    if (riskType) {
      items = items.filter((c) => c.riskType.toLowerCase() === riskType.toLowerCase());
    }

    if (minCompliance !== undefined) {
      items = items.filter((c) => c.complianceScore >= minCompliance);
    }

    // 8. Sort with stable ordering
    items.sort((a, b) => compareItems(a, b, sortParams.sortBy, sortParams.sortOrder));

    // 9. Paginate
    const result = paginateArray(items, paginationParams);

    // 10. Build response with applied filter metadata
    const invariants: SearchInvariants = {
      authorizedOwner: true,
      stableSort: true,
      boundedPage: true,
      duplicateCommitmentsRemoved: true,
    };
    const snapshot: SearchSnapshot = {
      queryKey: cacheKey,
      generatedAt: new Date().toISOString(),
      source: 'chain',
      rawCount: commitments.length,
      processedCount: sourceCommitments.length,
      rejectedRecords,
      duplicateRecords,
      truncated,
    };
    const responsePayload = {
      data: result.data,
      meta: result.meta,
      filters: {
        asset: asset ?? null,
        commitmentId: commitmentId ?? null,
        status: status ?? null,
        riskType: riskType ?? null,
        minCompliance: minCompliance ?? null,
        sortBy: sortParams.sortBy,
        sortOrder: sortParams.sortOrder,
      },
      snapshot,
      invariants,
    };

    // 11. Cache for short TTL
    await cache.set(cacheKey, responsePayload, CacheTTL.COMMITMENT_SEARCH);

    logInfo(req, '[api/commitments/search] served from chain', {
      correlationId,
      ownerAddress: normalizedOwnerAddress,
      durationMs: Date.now() - startedAt,
      chainDurationMs,
      rawCount: commitments.length,
      returnedCount: result.data.length,
      total: result.meta.total,
      cacheHit: false,
      truncated,
    });

    return ok(responsePayload, undefined, 200, correlationId);
  },
  { cors: SEARCH_CORS_POLICY },
);

// ─── Disallow other methods ───────────────────────────────────────────────────

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
