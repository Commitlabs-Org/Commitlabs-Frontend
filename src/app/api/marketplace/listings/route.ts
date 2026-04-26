import { NextRequest } from 'next/server';
import { ok } from '@/lib/backend/apiResponse';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ApiError, ValidationError } from '@/lib/backend/errors';
import { parseJsonWithLimit, JSON_BODY_LIMITS } from '@/lib/backend/jsonBodyLimit';
import {
    getMarketplaceSortKeys,
    isMarketplaceSortBy,
    listMarketplaceListings,
    type MarketplaceCommitmentType,
    type MarketplacePublicListing,
    marketplaceService,
} from '@/lib/backend/services/marketplace';
import type { CreateListingRequest, CreateListingResponse } from '@/types/marketplace';

/**
 * GET /api/marketplace/listings
 * Returns a paginated marketplace listing contract for the UI.
 * Auth: public read-only endpoint with rate limiting.
 * Query params:
 *   - type: optional commitment type filter (Safe|Balanced|Aggressive)
 *   - minCompliance, maxLoss, minAmount, maxAmount: optional numeric filters
 *   - sortBy: optional stable sort key; default is price
 *   - page: optional page number; default is 1
 *   - pageSize: optional page size; default is 10
 * Response:
 *   - listings: paged listing objects
 *   - cards: lightweight UI card payloads
 *   - total, page, pageSize: pagination contract fields
 * Error codes:
 *   - VALIDATION_ERROR: invalid query params
 *   - INTERNAL_ERROR: unexpected server failure
 */

const COMMITMENT_TYPES: readonly MarketplaceCommitmentType[] = ['Safe', 'Balanced', 'Aggressive'] as const;

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
        throw new Error(`Invalid '${key}' query param. Expected a number.`);
    }

    return parsed;
}

function parseInteger(searchParams: URLSearchParams, key: string, defaultValue: number): number {
    const raw = searchParams.get(key);
    if (raw === null) return defaultValue;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`Invalid '${key}' query param. Expected a positive integer.`);
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
        throw new Error(`Invalid 'type' query param. Allowed values: ${COMMITMENT_TYPES.join(', ')}.`);
    }

    return mapping[normalized];
}

function parseQuery(searchParams: URLSearchParams): ParseResult {
    const minAmount = parseNumber(searchParams, 'minAmount');
    const maxAmount = parseNumber(searchParams, 'maxAmount');

    if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
        throw new Error("Invalid amount filter. 'minAmount' cannot be greater than 'maxAmount'.");
    }

    const sortBy = searchParams.get('sortBy') ?? undefined;
    if (sortBy && !isMarketplaceSortBy(sortBy)) {
        throw new Error(`Invalid 'sortBy' query param. Allowed values: ${getMarketplaceSortKeys().join(', ')}.`);
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

export const GET = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, 'api/marketplace/listings');
    if (!allowed) {
        throw new TooManyRequestsError(undefined, undefined, retryAfterSeconds);
    }

    const { searchParams } = new URL(req.url);
    const filters = parseQuery(searchParams);
    const listings = await listMarketplaceListings(filters);

    return ok({
        listings,
        cards: listings.map(toMarketplaceCard),
        total: listings.length,
    });
});

export const POST = withApiHandler(async (req: NextRequest) => {
    let body: unknown;

        try {
                body = await parseJsonWithLimit(req, {
                        limitBytes: JSON_BODY_LIMITS.marketplaceListingsCreate,
                });
        } catch (err) {
                if (err instanceof ApiError) throw err;
                throw new ValidationError('Invalid JSON in request body');
        }

    if (!body || typeof body !== 'object') {
        throw new ValidationError('Request body must be an object');
    }

    const request = body as CreateListingRequest;
    const listing = await marketplaceService.createListing(request);

    const response: CreateListingResponse = {
        listing,
    };

    return ok(response, 201);
});

const _405 = methodNotAllowed(['GET', 'POST']);
export { _405 as PUT, _405 as PATCH, _405 as DELETE };
