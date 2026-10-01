import { NextRequest, NextResponse } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { isFeatureEnabled } from '@/lib/backend/config';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { ValidationError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { idempotencyService } from '@/lib/backend/idempotency';
import { parseJsonWithLimit, JSON_BODY_LIMITS } from '@/lib/backend/jsonBodyLimit';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { requireAuth } from '@/lib/backend/requireAuth';
import {
  getMarketplaceSortKeys,
  isMarketplaceSortBy,
  type MarketplaceCommitmentType,
  type MarketplacePublicListing,
} from '@/lib/backend/services/marketplace';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import type { CreateListingRequest, CreateListingResponse } from '@/types/marketplace';
import { MARKETPLACE_RATE_LIMIT_ACTIONS } from '@/lib/marketplace/constants';
import { listMarketplaceListings, marketplaceService } from '@/lib/marketplace';
import { enforceMarketplaceRateLimit } from '@/lib/marketplace/rate-limit';
import { emitMarketplaceTelemetry } from '@/lib/marketplace/telemetry';
import { parseBoundedPagination, parseOptionalNumber } from '@/lib/marketplace/validation';

const COMMITMENT_TYPES: readonly MarketplaceCommitmentType[] = [
  'Safe',
  'Balanced',
  'Aggressive',
] as const;

const MAX_LISTINGS_PAGE = 1000;
const MAX_LISTINGS_PAGE_SIZE = 100;
const MAX_COMPLIANCE = 100;
const MIN_COMPLIANCE = 0;
const MAX_LOSS_PERCENT = 100;
const MIN_LOSS_PERCENT = 0;

interface ParseResult {
  type?: MarketplaceCommitmentType;
  minCompliance?: number;
  maxLoss?: number;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  page?: number;
  pageSize?: number;
}

const MARKETPLACE_LISTINGS_CORS_POLICY = {
  GET: { access: 'public' },
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(MARKETPLACE_LISTINGS_CORS_POLICY);

function toMarketplaceCard(listing: MarketplacePublicListing) {
  return {
    id: listing.listingId,
    type: listing.type,
    score: listing.complianceScore,
    amount: `$${listing.amount.toLocaleString()}`,
    duration: `${listing.remainingDays} days`,
    yield: `${listing.currentYield}%`,
    maxLoss: `${listing.maxLoss}%`,
    price: `$${listing.price.toLocaleString()}`,
  };
}

function parseNumber(searchParams: URLSearchParams, key: string): number | undefined {
  const raw = searchParams.get(key);
  if (raw === null) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    throw new ValidationError(`Invalid '${key}' query param. Expected a number.`);
  }
  return parsed;
}

function parseInteger(
  searchParams: URLSearchParams,
  key: string,
  defaultValue: number,
  maxValue?: number,
): number {
  const raw = searchParams.get(key);
  if (raw === null) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`Invalid '${key}' query param. Expected a positive integer.`);
  }
  if (maxValue !== undefined && parsed > maxValue) {
    throw new ValidationError(
      `Invalid '${key}' query param. Must be ${maxValue} or smaller to bound response size.`,
    );
  }
  return parsed;
}

function parseType(searchParams: URLSearchParams): MarketplaceCommitmentType | undefined {
  const raw = searchParams.get('type');
  if (raw === null) return undefined;

  const normalized = raw.trim().toLowerCase();
  const mapping: Record<string, MarketplaceCommitmentType> = {
    safe: 'Safe',
    balanced: 'Balanced',
    aggressive: 'Aggressive',
  };

  if (!(normalized in mapping)) {
    throw new ValidationError(
      `Invalid 'type' query param. Allowed values: ${COMMITMENT_TYPES.join(', ')}.`,
    );
  }

  return mapping[normalized];
}

function parseQuery(searchParams: URLSearchParams): ParseResult {
  const minAmount = parseOptionalNumber(searchParams, 'minAmount');
  const maxAmount = parseOptionalNumber(searchParams, 'maxAmount');
  if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
    throw new ValidationError(
      "Invalid amount filter. 'minAmount' cannot be greater than 'maxAmount'.",
    );
  }
  if (minAmount !== undefined && minAmount < 0) {
    throw new ValidationError("'minAmount' must be non-negative.");
  }
  if (maxAmount !== undefined && maxAmount < 0) {
    throw new ValidationError("'maxAmount' must be non-negative.");
  }

  const minCompliance = parseOptionalNumber(searchParams, 'minCompliance');
  const maxLoss = parseOptionalNumber(searchParams, 'maxLoss');
  if (
    minCompliance !== undefined &&
    (minCompliance < MIN_COMPLIANCE || minCompliance > MAX_COMPLIANCE)
  ) {
    throw new ValidationError(
      `'minCompliance' must be between ${MIN_COMPLIANCE} and ${MAX_COMPLIANCE}.`,
    );
  }
  if (
    maxLoss !== undefined &&
    (maxLoss < MIN_LOSS_PERCENT || maxLoss > MAX_LOSS_PERCENT)
  ) {
    throw new ValidationError(
      `'maxLoss' must be between ${MIN_LOSS_PERCENT} and ${MAX_LOSS_PERCENT}.`,
    );
  }

  const sortBy = searchParams.get('sortBy') ?? undefined;
  if (sortBy && !isMarketplaceSortBy(sortBy)) {
    throw new ValidationError(
      `Invalid 'sortBy' query param. Allowed values: ${getMarketplaceSortKeys().join(', ')}.`,
    );
  }

  const { page, pageSize } = parseBoundedPagination(searchParams);
  if (page !== undefined && page < 1) {
    throw new ValidationError("'page' must be a positive integer.");
  }
  if (page !== undefined && page > MAX_LISTINGS_PAGE) {
    throw new ValidationError(`'page' exceeds maximum of ${MAX_LISTINGS_PAGE}.`);
  }
  if (pageSize !== undefined && pageSize > MAX_LISTINGS_PAGE_SIZE) {
    throw new ValidationError(`'pageSize' exceeds maximum of ${MAX_LISTINGS_PAGE_SIZE}.`);
  }

  return {
    type: parseType(searchParams),
    minCompliance,
    maxLoss,
    minAmount,
    maxAmount,
    sortBy,
    page: parseInteger(searchParams, 'page', 1),
    pageSize: parseInteger(searchParams, 'pageSize', 10, MAX_PAGE_SIZE),
  };

  if (type !== undefined) result.type = type;
  if (minCompliance !== undefined) result.minCompliance = minCompliance;
  if (maxLoss !== undefined) result.maxLoss = maxLoss;
  if (minAmount !== undefined) result.minAmount = minAmount;
  if (maxAmount !== undefined) result.maxAmount = maxAmount;
  if (sortBy !== undefined) result.sortBy = sortBy;

  return result;
}

export const GET = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
    const startedAt = Date.now();
    try {
      if (!isFeatureEnabled('marketplace')) {
        return NextResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Marketplace feature is disabled.',
              details: { feature: 'marketplace' },
            },
          },
          { status: 404 },
        );
      }

      const ip = getClientIp(req);
      await enforceMarketplaceRateLimit(ip, MARKETPLACE_RATE_LIMIT_ACTIONS.LIST);

      const { searchParams } = new URL(req.url);
      const filters = parseQuery(searchParams);
      const listings = await listMarketplaceListings(filters);

export const POST = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  // Authentication required for listing creation
  const authReq = requireAuth(req);
  const sellerAddress = authReq.user.address;

  // Rate-limit write operations per authenticated user
  if (!(await checkRateLimit(sellerAddress, 'api/marketplace/listings/create'))) {
    throw new TooManyRequestsError();
  }

  const body = await parseJsonWithLimit(req, {
    limitBytes: JSON_BODY_LIMITS.marketplaceListingsCreate,
  });

export const POST = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
    const startedAt = Date.now();
    try {
      if (!isFeatureEnabled('marketplace')) {
        return NextResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Marketplace feature is disabled.',
              details: { feature: 'marketplace' },
            },
          },
          { status: 404 },
        );
      }

  const request = body as CreateListingRequest;

  // Enforce that the authenticated caller is the declared seller
  if (request.sellerAddress && request.sellerAddress !== sellerAddress) {
    throw new ValidationError('sellerAddress must match the authenticated caller.');
  }

  // Fill in sellerAddress from session when not provided in body
  const enrichedRequest: CreateListingRequest = {
    ...request,
    sellerAddress: request.sellerAddress ?? sellerAddress,
  };

  const listing = await marketplaceService.createListing(enrichedRequest);
  const response: CreateListingResponse = { listing };
  return ok(response, undefined, 201, correlationId);
}, { cors: MARKETPLACE_LISTINGS_CORS_POLICY });

const _405 = methodNotAllowed(['GET', 'POST']);
export { _405 as PUT, _405 as PATCH, _405 as DELETE };
