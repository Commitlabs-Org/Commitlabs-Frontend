import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { createCommitmentOnChain } from '@/lib/backend/services/contracts';
import {
    normalizeBackendError,
    toBackendErrorResponse
} from '@/lib/backend/errors';

// src/app/api/commitments/route.ts
import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getMockData } from '@/lib/backend/mockDb';
import type { Commitment, CommitmentType, CommitmentStatus } from '@/lib/types/domain';
import { logInfo } from '@/lib/backend/logger';
import { validatePagination, validateFilters, validateAddress, handleValidationError, ValidationError, createCommitmentSchema } from '@/lib/backend/validation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');
    const status = searchParams.get('status');
    const creator = searchParams.get('creator');

    // Validate pagination
    const pagination = validatePagination(page, limit);

    const isAllowed = await checkRateLimit(ip, 'api/commitments');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    const { commitments } = await getMockData();

    return ok({ commitments }, 200);
});
import { logInfo } from '@/lib/backend/logger';
import { getBackendConfig } from '@/lib/backend/config';
import { createCommitmentOnChain } from '@/lib/backend/contracts';
import { parseCreateCommitmentInput } from '@/lib/backend/validation';
import { mapCommitmentFromChain } from '@/lib/backend/dto';
import {
    parsePaginationParams,
    parseSortParams,
    parseEnumFilter,
    paginateArray,
    paginationErrorResponse,
    PaginationParseError,
} from '@/lib/backend/pagination';

// ── Types ─────────────────────────────────────────────────────────────────────
// Commitment, CommitmentType, CommitmentStatus from @/lib/types/domain

// ── Constants ─────────────────────────────────────────────────────────────────

const COMMITMENT_TYPES = ['Safe', 'Balanced', 'Aggressive'] as const;
const COMMITMENT_STATUSES = ['Active', 'Settled', 'Violated', 'Early Exit'] as const;
const SORT_FIELDS = ['amount', 'complianceScore', 'daysRemaining', 'createdAt'] as const;
type CommitmentSortField = (typeof SORT_FIELDS)[number];

// ── Mock data (replace with DB queries) ───────────────────────────────────────

const MOCK_COMMITMENTS: Commitment[] = [
    { id: 'CMT-ABC123', type: 'Safe', status: 'Active', asset: 'XLM', amount: '50000', complianceScore: 95, daysRemaining: 15, createdAt: '2026-01-10T00:00:00Z' },
    { id: 'CMT-XYZ789', type: 'Balanced', status: 'Active', asset: 'USDC', amount: '100000', complianceScore: 88, daysRemaining: 42, createdAt: '2025-12-15T00:00:00Z' },
    { id: 'CMT-DEF456', type: 'Aggressive', status: 'Active', asset: 'XLM', amount: '250000', complianceScore: 76, daysRemaining: 75, createdAt: '2025-11-20T00:00:00Z' },
    { id: 'CMT-GHI012', type: 'Safe', status: 'Settled', asset: 'XLM', amount: '75000', complianceScore: 97, daysRemaining: 0, createdAt: '2025-12-01T00:00:00Z' },
    { id: 'CMT-JKL345', type: 'Balanced', status: 'Early Exit', asset: 'USDC', amount: '150000', complianceScore: 72, daysRemaining: 0, createdAt: '2025-11-01T00:00:00Z' },
    { id: 'CMT-MNO678', type: 'Aggressive', status: 'Violated', asset: 'XLM', amount: '200000', complianceScore: 45, daysRemaining: 0, createdAt: '2025-10-15T00:00:00Z' },
    { id: 'CMT-PQR901', type: 'Safe', status: 'Active', asset: 'XLM', amount: '30000', complianceScore: 92, daysRemaining: 20, createdAt: '2026-01-20T00:00:00Z' },
    { id: 'CMT-STU234', type: 'Balanced', status: 'Active', asset: 'USDC', amount: '80000', complianceScore: 85, daysRemaining: 33, createdAt: '2026-01-05T00:00:00Z' },
];

/**
 * GET /api/commitments
 *
 * Query params:
 *   Pagination : page, pageSize
 *   Sorting    : sortBy (amount | complianceScore | daysRemaining | createdAt)
 *                sortOrder (asc | desc)
 *   Filters    : type   (Safe | Balanced | Aggressive)
 *                status (Active | Settled | Violated | Early Exit)
 *
 * Example:
 *   /api/commitments?type=Safe&status=Active&sortBy=amount&sortOrder=desc&page=1&pageSize=5
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
    const isAllowed = await checkRateLimit(ip, 'api/commitments');

    if (!isAllowed) {
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429 }
        );
    }

    const { searchParams } = new URL(req.url);

    try {
        const pagination = parsePaginationParams(searchParams, { defaultPageSize: 10 });
        const { sortBy, sortOrder } = parseSortParams<CommitmentSortField>(searchParams, SORT_FIELDS, 'createdAt', 'desc');
        const typeFilter = parseEnumFilter(searchParams, 'type', COMMITMENT_TYPES);
        const statusFilter = parseEnumFilter(searchParams, 'status', COMMITMENT_STATUSES);

        let results = MOCK_COMMITMENTS;
        if (typeFilter) results = results.filter((c) => c.type === typeFilter);
        if (statusFilter) results = results.filter((c) => c.status === statusFilter);

        results = [...results].sort((a, b) => {
            const valA = a[sortBy];
            const valB = b[sortBy];
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            const numA = typeof valA === 'string' ? parseFloat(valA) : (valA as number);
            const numB = typeof valB === 'string' ? parseFloat(valB) : (valB as number);
            return sortOrder === 'asc' ? numA - numB : numB - numA;
        });

        return NextResponse.json({ success: true, data: paginateArray(results, pagination) });

    } catch (err) {
        if (err instanceof PaginationParseError) return paginationErrorResponse(err);
        console.error('[GET /api/commitments] Unhandled error:', err);
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
            { status: 500 }
        );
    }
}


interface CreateCommitmentRequestBody {
    ownerAddress: string;
    asset: string;
    amount: string;
    durationDays: number;
    maxLossBps: number;
    metadata?: Record<string, unknown>;
}

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/commitments');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    try {
        const body = (await req.json()) as CreateCommitmentRequestBody;
        const result = await createCommitmentOnChain({
            ownerAddress: body.ownerAddress,
            asset: body.asset,
            amount: body.amount,
            durationDays: body.durationDays,
            maxLossBps: body.maxLossBps,
            metadata: body.metadata
        });
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        const normalized = normalizeBackendError(error, {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create commitment.',
            status: 500
        });
        return NextResponse.json(toBackendErrorResponse(normalized), {
            status: normalized.status
        });
    }
});
    logInfo(req, 'Creating commitment', { ip });

    // TODO(issue-126): Enforce validateSession(req) per docs/backend-session-csrf.md before mutating state.
    // TODO(issue-126): Enforce CSRF validation for browser cookie-auth requests (token + origin checks).
    // TODO: validate request body, interact with Soroban smart contract,
    //       store commitment record in database, mint NFT, etc.

    return ok({ message: 'Commitment created successfully.' }, 201);
});
    // Validate filters
    const filters = validateFilters({ status, creator });

    // If creator is provided, validate it as address
    if (filters.creator) {
      validateAddress(filters.creator as string);
    }

    // Mock response - in real app, fetch from database
    const commitments = [
      { id: '1', title: 'Sample Commitment', creator: 'GABC...', amount: 100 },
      // ... more
    ];

    return Response.json({
      commitments,
      pagination,
      filters,
      total: commitments.length
    });
  } catch (error) {
    return handleValidationError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = createCommitmentSchema.parse(body);

    // Mock creation - in real app, save to database
    const newCommitment = {
      id: Date.now().toString(),
      title: validatedData.title,
      description: validatedData.description,
      amount: validatedData.amount,
      creator: validatedData.creatorAddress,
      createdAt: new Date().toISOString()
    };

    return Response.json(newCommitment, { status: 201 });
  } catch (error) {
    return handleValidationError(error);
  }
}
