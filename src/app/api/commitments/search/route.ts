// src/app/api/commitments/search/route.ts
//
// Commitment search endpoint with rich filtering by asset, status, and risk type.
// Uses Zod validation, pagination.ts utilities for stable sorting/paging, and
// a short-TTL cache for common queries.

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, methodNotAllowed } from "@/lib/backend/apiResponse";
import {
  createCorsOptionsHandler,
  type CorsRoutePolicy,
} from "@/lib/backend/cors";
import { TooManyRequestsError, ValidationError } from "@/lib/backend/errors";
import { getClientIp } from "@/lib/backend/getClientIp";
import { checkRateLimit } from "@/lib/backend/rateLimit";
import { getUserCommitmentsFromChain } from "@/lib/backend/services/contracts";
import type { ChainCommitmentStatus } from "@/lib/backend/services/contracts";
import { withApiHandler } from "@/lib/backend/withApiHandler";
import {
  parsePaginationParams,
  parseSortParams,
  paginateArray,
  paginationErrorResponse,
  PaginationParseError,
  type SortOrder,
} from "@/lib/backend/pagination";
import { cache } from "@/lib/backend/cache/factory";
import { CacheKey, CacheTTL } from "@/lib/backend/cache/index";
import { createHash } from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Allowed `CommitmentStatus` filter values.
 * Maps user-facing values to the on-chain `ChainCommitmentStatus` type.
 */
const COMMITMENT_STATUS_VALUES = [
  "ACTIVE",
  "SETTLED",
  "VIOLATED",
  "EARLY_EXIT",
] as const;
type CommitmentStatusFilter = (typeof COMMITMENT_STATUS_VALUES)[number];

/** Risk type filter – mirrors `CommitmentType` from domain types. */
const RISK_TYPE_VALUES = ["Safe", "Balanced", "Aggressive"] as const;
type RiskTypeFilter = (typeof RISK_TYPE_VALUES)[number];

/** Fields available for `sortBy`. */
const SORTABLE_FIELDS = [
  "createdAt",
  "amount",
  "complianceScore",
  "status",
  "asset",
] as const;
type SortableField = (typeof SORTABLE_FIELDS)[number];

// ─── Zod validation schema ───────────────────────────────────────────────────

const CommitmentSearchQuerySchema = z.object({
  /** Owner address – required to scope the search. */
  ownerAddress: z.string().min(1, "ownerAddress is required"),

  /** Filter by asset code (e.g. "XLM", "USDC"). Case-insensitive match. */
  asset: z.string().optional(),

  /**
   * Filter by commitment status.
   * Accepted values: ACTIVE, SETTLED, VIOLATED, EARLY_EXIT.
   */
  status: z
    .enum(COMMITMENT_STATUS_VALUES)
    .optional(),

  /**
   * Filter by risk type.
   * Accepted values: Safe, Balanced, Aggressive.
   */
  riskType: z
    .enum(RISK_TYPE_VALUES)
    .optional(),

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
  return "Safe";
}

/**
 * Deterministic cache key for a given search query.
 * Hashes the normalised filter parameters to avoid key collisions.
 */
function buildSearchCacheKey(
  ownerAddress: string,
  filters: Record<string, string | number | undefined>,
): string {
  const payload = JSON.stringify({ ownerAddress, ...filters });
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 16);
  return CacheKey.commitmentSearch(hash);
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
  const dir = order === "asc" ? 1 : -1;

  let cmp: number;
  switch (field) {
    case "amount": {
      cmp = Number(a.amount) - Number(b.amount);
      break;
    }
    case "complianceScore": {
      cmp = a.complianceScore - b.complianceScore;
      break;
    }
    case "createdAt": {
      const dateA = new Date(a.createdAt).getTime() || 0;
      const dateB = new Date(b.createdAt).getTime() || 0;
      cmp = dateA - dateB;
      break;
    }
    case "status": {
      cmp = a.status.localeCompare(b.status);
      break;
    }
    case "asset": {
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
  GET: { access: "first-party" },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(SEARCH_CORS_POLICY);

// ─── GET handler ──────────────────────────────────────────────────────────────

export const GET = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
    // 1. Rate limit
    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, "api/commitments/search"))) {
      throw new TooManyRequestsError();
    }

    // 2. Parse & validate query params with Zod
    const { searchParams } = new URL(req.url);
    const rawQuery = Object.fromEntries(searchParams.entries());
    const queryResult = CommitmentSearchQuerySchema.safeParse(rawQuery);

    if (!queryResult.success) {
      throw new ValidationError(
        "Invalid search parameters",
        queryResult.error.issues,
      );
    }

    const { ownerAddress, asset, status, riskType, minCompliance } =
      queryResult.data;

    // 3. Parse pagination & sort via pagination.ts helpers
    let paginationParams;
    let sortParams;
    try {
      paginationParams = parsePaginationParams(searchParams);
      sortParams = parseSortParams(
        searchParams,
        SORTABLE_FIELDS,
        "createdAt",
        "desc",
      );
    } catch (err) {
      if (err instanceof PaginationParseError) {
        return paginationErrorResponse(err);
      }
      throw err;
    }

    // 4. Build cache key and check cache
    const cacheKey = buildSearchCacheKey(ownerAddress, {
      asset,
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
      return ok(cached, undefined, 200, correlationId);
    }

    // 5. Fetch from chain
    const commitments = await getUserCommitmentsFromChain(ownerAddress);

    // 6. Map to search items
    let items: CommitmentSearchItem[] = commitments.map((c: any) => ({
      commitmentId: String(c.id ?? c.commitmentId),
      ownerAddress: c.ownerAddress,
      asset: c.asset,
      amount:
        typeof c.amount === "bigint" ? String(c.amount) : String(c.amount),
      status: c.status as ChainCommitmentStatus,
      riskType: inferRiskType(c),
      complianceScore: c.complianceScore ?? 0,
      currentValue:
        typeof c.currentValue === "bigint"
          ? String(c.currentValue)
          : String(c.currentValue ?? "0"),
      feeEarned: String(c.feeEarned ?? "0"),
      violationCount: c.violationCount ?? 0,
      createdAt: c.createdAt ?? new Date().toISOString(),
      expiresAt: c.expiresAt ?? new Date().toISOString(),
    }));

    // 7. Apply filters
    if (asset) {
      const normalizedAsset = asset.toUpperCase();
      items = items.filter((c) => c.asset.toUpperCase() === normalizedAsset);
    }

    if (status) {
      items = items.filter((c) => c.status === status);
    }

    if (riskType) {
      items = items.filter(
        (c) => c.riskType.toLowerCase() === riskType.toLowerCase(),
      );
    }

    if (minCompliance !== undefined) {
      items = items.filter((c) => c.complianceScore >= minCompliance);
    }

    // 8. Sort with stable ordering
    items.sort((a, b) =>
      compareItems(a, b, sortParams.sortBy, sortParams.sortOrder),
    );

    // 9. Paginate
    const result = paginateArray(items, paginationParams);

    // 10. Build response with applied filter metadata
    const responsePayload = {
      data: result.data,
      meta: result.meta,
      filters: {
        asset: asset ?? null,
        status: status ?? null,
        riskType: riskType ?? null,
        minCompliance: minCompliance ?? null,
        sortBy: sortParams.sortBy,
        sortOrder: sortParams.sortOrder,
      },
    };

    // 11. Cache for short TTL
    await cache.set(cacheKey, responsePayload, CacheTTL.COMMITMENT_SEARCH);

    return ok(responsePayload, undefined, 200, correlationId);
  },
  { cors: SEARCH_CORS_POLICY },
);

// ─── Disallow other methods ───────────────────────────────────────────────────

const _405 = methodNotAllowed(["GET"]);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
