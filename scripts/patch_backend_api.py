from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent

files = {
    'src/app/api/marketplace/listings/route.ts': """import { NextRequest, NextResponse } from 'next/server';
import { ok } from '@/lib/backend/apiResponse';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ValidationError } from '@/lib/backend/errors';
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

export async function GET(req: NextRequest): Promise<NextResponse> {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
    const isAllowed = await checkRateLimit(ip, 'api/marketplace/listings');

    if (!isAllowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const filters = parseQuery(searchParams);
        const { items: listings, total, page, pageSize } = await listMarketplaceListings(filters);

        return ok({
            listings,
            cards: listings.map(toMarketplaceCard),
            total,
            page,
            pageSize,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list marketplace listings.';
        const isValidation = message.startsWith('Invalid');

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: isValidation ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
                    message,
                },
            },
            { status: isValidation ? 400 : 500 }
        );
    }
}

export const POST = withApiHandler(async (req: NextRequest) => {
        let body: unknown;

        try {
                body = await req.json();
        } catch {
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
""",

    'src/app/api/commitments/route.ts': """import { NextRequest } from 'next/server'
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
    return fail('Missing ownerAddress', 'BAD_REQUEST', 400);
  }

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return fail('Invalid pagination params', 'BAD_REQUEST', 400);
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
    return fail('Invalid ownerAddress', 'BAD_REQUEST', 400);
  }

  if (!asset || typeof asset !== 'string') {
    return fail('Invalid asset', 'BAD_REQUEST', 400);
  }

  if (!amount || isNaN(Number(amount))) {
    return fail('Invalid amount', 'BAD_REQUEST', 400);
  }

  if (!durationDays || durationDays <= 0) {
    return fail('Invalid durationDays', 'BAD_REQUEST', 400);
  }

  if (maxLossBps == null || maxLossBps < 0) {
    return fail('Invalid maxLossBps', 'BAD_REQUEST', 400);
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
""",

    'src/lib/backend/services/marketplace.ts': """import { logInfo } from '../logger';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import type {
  MarketplaceListing,
  CreateListingRequest,
} from '@/lib/types/domain';

export type MarketplaceCommitmentType = 'Safe' | 'Balanced' | 'Aggressive';

export interface MarketplacePublicListing {
  listingId: string;
  commitmentId: string;
  type: MarketplaceCommitmentType;
  amount: number;
  remainingDays: number;
  maxLoss: number;
  currentYield: number;
  complianceScore: number;
  price: number;
}

export interface MarketplaceListingsQuery {
  type?: MarketplaceCommitmentType;
  minCompliance?: number;
  maxLoss?: number;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  page?: number;
  pageSize?: number;
}

export interface MarketplaceListingsResult {
  items: MarketplacePublicListing[];
  total: number;
  page: number;
  pageSize: number;
}

const MOCK_LISTINGS: MarketplacePublicListing[] = [
  {
    listingId: 'LST-001',
    commitmentId: 'CMT-001',
    type: 'Safe',
    amount: 50000,
    remainingDays: 25,
    maxLoss: 2,
    currentYield: 5.2,
    complianceScore: 95,
    price: 52000,
  },
  {
    listingId: 'LST-002',
    commitmentId: 'CMT-002',
    type: 'Balanced',
    amount: 100000,
    remainingDays: 45,
    maxLoss: 8,
    currentYield: 12.5,
    complianceScore: 88,
    price: 105000,
  },
  {
    listingId: 'LST-003',
    commitmentId: 'CMT-003',
    type: 'Aggressive',
    amount: 250000,
    remainingDays: 80,
    maxLoss: 100,
    currentYield: 18.7,
    complianceScore: 76,
    price: 262000,
  },
  {
    listingId: 'LST-004',
    commitmentId: 'CMT-004',
    type: 'Safe',
    amount: 75000,
    remainingDays: 15,
    maxLoss: 2,
    currentYield: 4.8,
    complianceScore: 92,
    price: 76500,
  },
  {
    listingId: 'LST-005',
    commitmentId: 'CMT-005',
    type: 'Balanced',
    amount: 150000,
    remainingDays: 55,
    maxLoss: 8,
    currentYield: 11.3,
    complianceScore: 85,
    price: 155000,
  },
  {
    listingId: 'LST-006',
    commitmentId: 'CMT-006',
    type: 'Aggressive',
    amount: 500000,
    remainingDays: 85,
    maxLoss: 100,
    currentYield: 22.1,
    complianceScore: 72,
    price: 525000,
  },
];

const SORT_CONFIG = {
  price: { key: 'price', order: 'desc' },
  amount: { key: 'amount', order: 'desc' },
  complianceScore: { key: 'complianceScore', order: 'desc' },
  remainingDays: { key: 'remainingDays', order: 'asc' },
  maxLoss: { key: 'maxLoss', order: 'asc' },
  currentYield: { key: 'currentYield', order: 'desc' },
} as const satisfies Record<
  string,
  { key: keyof MarketplacePublicListing; order: 'asc' | 'desc' }
>;

export type MarketplaceSortBy = keyof typeof SORT_CONFIG;

function sortListings(
  listings: MarketplacePublicListing[],
  sortBy: MarketplaceSortBy,
): MarketplacePublicListing[] {
  const { key, order } = SORT_CONFIG[sortBy];

  return [...listings].sort((a, b) => {
    const lhs = a[key] as number;
    const rhs = b[key] as number;
    return order === 'asc' ? lhs - rhs : rhs - lhs;
  });
}

export function isMarketplaceSortBy(value: string): value is MarketplaceSortBy {
  return value in SORT_CONFIG;
}

export function getMarketplaceSortKeys(): MarketplaceSortBy[] {
  return Object.keys(SORT_CONFIG) as MarketplaceSortBy[];
}

export async function listMarketplaceListings(
  query: MarketplaceListingsQuery,
): Promise<MarketplaceListingsResult> {
  let results = MOCK_LISTINGS;

  if (query.type) {
    results = results.filter((listing) => listing.type === query.type);
  }
  if (query.minCompliance !== undefined) {
    const minCompliance = query.minCompliance;
    results = results.filter(
      (listing) => listing.complianceScore >= minCompliance,
    );
  }
  if (query.maxLoss !== undefined) {
    const maxLoss = query.maxLoss;
    results = results.filter((listing) => listing.maxLoss <= maxLoss);
  }
  if (query.minAmount !== undefined) {
    const minAmount = query.minAmount;
    results = results.filter((listing) => listing.amount >= minAmount);
  }
  if (query.maxAmount !== undefined) {
    const maxAmount = query.maxAmount;
    results = results.filter((listing) => listing.amount <= maxAmount);
  }

  const sortBy =
    query.sortBy && isMarketplaceSortBy(query.sortBy) ? query.sortBy : 'price';

  const sorted = sortListings(results, sortBy);
  const page = Number.isInteger(query.page) && query.page && query.page > 0 ? query.page : 1;
  const pageSize = Number.isInteger(query.pageSize) && query.pageSize && query.pageSize > 0 ? query.pageSize : 10;
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize);

  return { items, total, page, pageSize };
}

class MarketplaceService {
  private listings: Map<string, MarketplaceListing> = new Map();
  private listingCounter = 0;

  async createListing(
    request: CreateListingRequest,
  ): Promise<MarketplaceListing> {
    logInfo(undefined, '[MarketplaceService] Creating listing', { request });

    this.validateCreateListingRequest(request);

    const existingListing = Array.from(this.listings.values()).find(
      (listing) =>
        listing.commitmentId === request.commitmentId &&
        listing.status === 'Active',
    );

    if (existingListing) {
      throw new ConflictError(
        'Commitment is already listed on the marketplace.',
        {
          commitmentId: request.commitmentId,
          existingListingId: existingListing.id,
        },
      );
    }

    this.listingCounter += 1;
    const listingId = `listing_${this.listingCounter}_${Date.now()}`;

    const listing: MarketplaceListing = {
      id: listingId,
      commitmentId: request.commitmentId,
      price: request.price,
      currencyAsset: request.currencyAsset,
      sellerAddress: request.sellerAddress,
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.listings.set(listingId, listing);

    logInfo(undefined, '[MarketplaceService] Listing created', { listingId });

    return listing;
  }

  async cancelListing(listingId: string, sellerAddress: string): Promise<void> {
    logInfo(undefined, '[MarketplaceService] Cancelling listing', {
      listingId,
      sellerAddress,
    });

    const listing = this.listings.get(listingId);

    if (!listing) {
      throw new NotFoundError('Listing', { listingId });
    }

    if (listing.sellerAddress !== sellerAddress) {
      throw new ValidationError('Only the seller can cancel this listing.', {
        listingId,
        expectedSeller: listing.sellerAddress,
        providedSeller: sellerAddress,
      });
    }

    if (listing.status !== 'Active') {
      throw new ConflictError('Only active listings can be cancelled.', {
        listingId,
        currentStatus: listing.status,
      });
    }

    listing.status = 'Cancelled';
    listing.updatedAt = new Date().toISOString();
    this.listings.set(listingId, listing);

    logInfo(undefined, '[MarketplaceService] Listing cancelled', { listingId });
  }

  async getListing(listingId: string): Promise<MarketplaceListing | null> {
    return this.listings.get(listingId) ?? null;
  }

  private validateCreateListingRequest(request: CreateListingRequest): void {
    const errors: string[] = [];

    if (!request.commitmentId || typeof request.commitmentId !== 'string') {
      errors.push('commitmentId is required and must be a string');
    }

    if (!request.price || typeof request.price !== 'string') {
      errors.push('price is required and must be a string');
    } else {
      const priceNum = Number.parseFloat(request.price);
      if (Number.isNaN(priceNum) || priceNum <= 0) {
        errors.push('price must be a positive number');
      }
    }

    if (!request.currencyAsset || typeof request.currencyAsset !== 'string') {
      errors.push('currencyAsset is required and must be a string');
    }

    if (!request.sellerAddress || typeof request.sellerAddress !== 'string') {
      errors.push('sellerAddress is required and must be a string');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid listing request', { errors });
    }
  }
}

export const marketplaceService = new MarketplaceService();
""",

    'src/app/api/commitments/route.test.ts': """import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { getUserCommitmentsFromChain, createCommitmentOnChain } from '@/lib/backend/services/contracts';

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
  createCommitmentOnChain: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/backend/withApiHandler', () => ({
  withApiHandler: (handler: unknown) => handler,
}));

describe('/api/commitments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when ownerAddress is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/commitments');

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 for invalid pagination', async () => {
    const request = new NextRequest('http://localhost:3000/api/commitments?ownerAddress=owner&page=0&pageSize=200');

    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });

  it('returns paginated commitments and converts bigint fields to strings', async () => {
    const mockCommitments = [
      {
        id: 1n,
        ownerAddress: 'GTESTOWNER',
        asset: 'USDC',
        amount: 100000n,
        status: 'Active',
        complianceScore: 92,
        currentValue: 110000n,
        feeEarned: 1000,
        violationCount: 0,
        createdAt: '2026-04-01T00:00:00.000Z',
        expiresAt: '2026-04-25T00:00:00.000Z',
      },
      {
        id: 2n,
        ownerAddress: 'GTESTOWNER',
        asset: 'USDC',
        amount: 200000n,
        status: 'Active',
        complianceScore: 90,
        currentValue: 210000n,
        feeEarned: 2000,
        violationCount: 1,
        createdAt: '2026-04-02T00:00:00.000Z',
        expiresAt: '2026-05-02T00:00:00.000Z',
      },
    ];

    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue(mockCommitments as any);

    const request = new NextRequest('http://localhost:3000/api/commitments?ownerAddress=GTESTOWNER&page=1&pageSize=1');
    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.page).toBe(1);
    expect(data.data.pageSize).toBe(1);
    expect(data.data.total).toBe(2);
    expect(data.data.items).toHaveLength(1);
    expect(data.data.items[0]).toMatchObject({
      commitmentId: '1',
      amount: '100000',
      currentValue: '110000',
    });
  });

  it('creates a commitment successfully', async () => {
    const responsePayload = { commitmentId: 'commitment_1' };
    vi.mocked(createCommitmentOnChain).mockResolvedValue(responsePayload);

    const request = new NextRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: JSON.stringify({
        ownerAddress: 'GTESTOWNER',
        asset: 'USDC',
        amount: '1000',
        durationDays: 30,
        maxLossBps: 100,
      }),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(responsePayload);
    expect(createCommitmentOnChain).toHaveBeenCalledWith({
      ownerAddress: 'GTESTOWNER',
      asset: 'USDC',
      amount: '1000',
      durationDays: 30,
      maxLossBps: 100,
      metadata: undefined,
    });
  });
});
""",

    'src/app/api/marketplace/listings/route.test.ts': """import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { marketplaceService } from '@/lib/backend/services/marketplace';

vi.mock('@/lib/backend/services/marketplace', async () => {
  const actual = await vi.importActual<typeof import('@/lib/backend/services/marketplace')>('@/lib/backend/services/marketplace');
  return {
    ...actual,
    marketplaceService: {
      createListing: vi.fn(),
    },
  };
});

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/backend/withApiHandler', () => ({
  withApiHandler: (handler: unknown) => handler,
}));

describe('Marketplace listings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should paginate and sort listings with stable ordering', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings?sortBy=amount&page=1&pageSize=2');
    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.page).toBe(1);
    expect(data.data.pageSize).toBe(2);
    expect(data.data.total).toBe(6);
    expect(data.data.listings).toHaveLength(2);
    expect(data.data.listings[0].amount).toBe(500000);
    expect(data.data.listings[1].amount).toBe(250000);
  });

  it('should return validation error for invalid sortBy', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings?sortBy=invalid');
    const response = await GET(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should create a listing successfully', async () => {
    const mockListing = {
      id: 'listing_1_1234567890',
      commitmentId: 'commitment_123',
      price: '1000.50',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      status: 'Active',
      createdAt: '2026-02-25T10:00:00.000Z',
      updatedAt: '2026-02-25T10:00:00.000Z',
    };

    vi.mocked(marketplaceService.createListing).mockResolvedValue(mockListing as any);

    const requestBody = {
      commitmentId: 'commitment_123',
      price: '1000.50',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.listing).toEqual(mockListing);
    expect(marketplaceService.createListing).toHaveBeenCalledWith(requestBody);
  });

  it('should return 400 when request body is invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when request body is not an object', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify('string instead of object'),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when request body is null', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(null),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should propagate validation errors from service', async () => {
    const validationError = new Error('Invalid listing request');

    vi.mocked(marketplaceService.createListing).mockRejectedValue(validationError);

    const requestBody = {
      commitmentId: 'commitment_123',
      price: '-100',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should propagate conflict errors from service', async () => {
    const conflictError = new Error('Commitment is already listed on the marketplace.');

    vi.mocked(marketplaceService.createListing).mockRejectedValue(conflictError);

    const requestBody = {
      commitmentId: 'commitment_duplicate',
      price: '1000.50',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
  });
});
""",
}

for relative_path, content in files.items():
    path = repo_root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
    print(f'Updated {relative_path}')
