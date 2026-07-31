import { NextRequest, NextResponse } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { isFeatureEnabled } from '@/lib/backend/config';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { TooManyRequestsError, ValidationError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { parseJsonWithLimit, JSON_BODY_LIMITS } from '@/lib/backend/jsonBodyLimit';
import { checkRateLimit, getRateLimitWindowSeconds } from '@/lib/backend/rateLimit';
import {
  getMarketplaceSortKeys,
  isMarketplaceSortBy,
  listMarketplaceListings,
  marketplaceService,
  type MarketplaceCommitmentType,
  type MarketplacePublicListing,
} from '@/lib/backend/services/marketplace';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import type { CreateListingRequest, CreateListingResponse } from '@/types/marketplace';

const COMMITMENT_TYPES: readonly MarketplaceCommitmentType[] = [
  'Safe',
  'Balanced',
  'Aggressive',
] as const;

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

function parseInteger(searchParams: URLSearchParams, key: string, defaultValue: number): number {
  const raw = searchParams.get(key);
  if (raw === null) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`Invalid '${key}' query param. Expected a positive integer.`);
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
  const minAmount = parseNumber(searchParams, 'minAmount');
  const maxAmount = parseNumber(searchParams, 'maxAmount');
  if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
    throw new ValidationError(
      "Invalid amount filter. 'minAmount' cannot be greater than 'maxAmount'.",
    );
  }

  const sortBy = searchParams.get('sortBy') ?? undefined;
  if (sortBy && !isMarketplaceSortBy(sortBy)) {
    throw new ValidationError(
      `Invalid 'sortBy' query param. Allowed values: ${getMarketplaceSortKeys().join(', ')}.`,
    );
  }

  return {
    type: parseType(searchParams),
    minCompliance: parseNumber(searchParams, 'minCompliance'),
    maxLoss: parseNumber(searchParams, 'maxLoss'),
    minAmount,
    maxAmount,
    sortBy,
    page: parseInteger(searchParams, 'page', 1),
    pageSize: parseInteger(searchParams, 'pageSize', 10),
  };
}

export const GET = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
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
    if (!(await checkRateLimit(ip, 'api/marketplace/listings'))) {
      throw new TooManyRequestsError();
    }

    const { searchParams } = new URL(req.url);
    const filters = parseQuery(searchParams);
    const listings = await listMarketplaceListings(filters);

    return ok(
      {
        listings,
        cards: listings.map(toMarketplaceCard),
        total: listings.length,
      },
      undefined,
      200,
      correlationId,
    );
  },
  { cors: MARKETPLACE_LISTINGS_CORS_POLICY, enableETag: true },
);

export const POST = withApiHandler(
  async (req: NextRequest, _context, correlationId) => {
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

    assertMutationCsrf(req);

    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 'api/marketplace/listings/create'))) {
      throw new TooManyRequestsError(
        'Too many requests. Please try again later.',
        undefined,
        getRateLimitWindowSeconds('api/marketplace/listings/create'),
      );
    }

    const body = await parseJsonWithLimit(req, {
      limitBytes: JSON_BODY_LIMITS.marketplaceListingsCreate,
    });

    if (!body || typeof body !== 'object') {
      throw new ValidationError('Request body must be an object');
    }

    const request = body as CreateListingRequest;
    const listing = await marketplaceService.createListing(request);
    const response: CreateListingResponse = { listing };
    return ok(response, undefined, 201, correlationId);
  },
  { cors: MARKETPLACE_LISTINGS_CORS_POLICY },
);

const _405 = methodNotAllowed(['GET', 'POST']);
export { _405 as PUT, _405 as PATCH, _405 as DELETE };
