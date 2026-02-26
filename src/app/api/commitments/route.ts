import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/response';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { createCommitmentOnChain } from '@/lib/backend/services/contracts';
import { logInfo } from '@/lib/backend/logger';
import {
    parsePaginationParams,
    parseSortParams,
    parseEnumFilter,
    paginateArray,
    PaginationParseError,
    paginationErrorResponse
} from '@/lib/backend/pagination';
import type { Commitment, CommitmentType, CommitmentStatus } from '@/lib/types/domain';

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

// ── GET Handler ───────────────────────────────────────────────────────────────

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
export const GET = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
    const isAllowed = await checkRateLimit(ip, 'api/commitments');

    if (!isAllowed) {
        throw new TooManyRequestsError();
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
            // Helper to get value or default for optional fields
            const getVal = (obj: Commitment, key: CommitmentSortField) => {
                if (key === 'createdAt') return obj.createdAt || '';
                if (key === 'complianceScore') return obj.complianceScore || 0;
                if (key === 'daysRemaining') return obj.daysRemaining || 0;
                return obj[key];
            };

            const valA = getVal(a, sortBy);
            const valB = getVal(b, sortBy);

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            const numA = typeof valA === 'string' ? parseFloat(valA) : (valA as number);
            const numB = typeof valB === 'string' ? parseFloat(valB) : (valB as number);
            return sortOrder === 'asc' ? numA - numB : numB - numA;
        });

        return ok(paginateArray(results, pagination));

    } catch (err) {
        if (err instanceof PaginationParseError) return paginationErrorResponse(err);
        throw err;
    }
});


// ── POST Handler ──────────────────────────────────────────────────────────────

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

    const body = (await req.json()) as CreateCommitmentRequestBody;
    
    logInfo(req, 'Creating commitment', { ip, owner: body.ownerAddress });

    // Mock implementation or calls to services
    const result = await createCommitmentOnChain({
        ownerAddress: body.ownerAddress,
        asset: body.asset,
        amount: body.amount,
        durationDays: body.durationDays,
        maxLossBps: body.maxLossBps,
        metadata: body.metadata
    });
    
    return ok(result, 201);
});
