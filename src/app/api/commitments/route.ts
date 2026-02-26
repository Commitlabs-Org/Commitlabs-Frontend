import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'


interface CommitmentData {
  id: string
  title: string
  amount: number
  status: string
  createdAt: string
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'active'
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Mock data - in production, this would call Soroban contracts
    const mockCommitments: CommitmentData[] = [
      {
        id: '1',
        title: 'Liquidity Commitment - USDC',
        amount: 10000,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Liquidity Commitment - EUR',
        amount: 5000,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ]

    // Filter by status
    const filteredCommitments = mockCommitments.filter(
      (c) => c.status === status
    )

    // Apply pagination
    const paginatedCommitments = filteredCommitments.slice(
      offset,
      offset + limit
    )

    return NextResponse.json(
      {
        data: paginatedCommitments,
        total: filteredCommitments.length,
        limit,
        offset,
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch commitments',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/backend/rateLimit";
import { createCommitmentOnChain } from "@/lib/backend/services/contracts";
import {
  normalizeBackendError,
  toBackendErrorResponse,
} from "@/lib/backend/errors";
import { logInfo } from "@/lib/backend/logger";
import type { Commitment } from "@/lib/types/domain";
import {
  parsePaginationParams,
  parseSortParams,
  parseEnumFilter,
  paginateArray,
  paginationErrorResponse,
  PaginationParseError,
} from "@/lib/backend/pagination";

// ── Constants ─────────────────────────────────────────────────────────────────

const COMMITMENT_TYPES = ["Safe", "Balanced", "Aggressive"] as const;
const COMMITMENT_STATUSES = [
  "Active",
  "Settled",
  "Violated",
  "Early Exit",
] as const;
const SORT_FIELDS = [
  "amount",
  "complianceScore",
  "daysRemaining",
  "createdAt",
] as const;
type CommitmentSortField = (typeof SORT_FIELDS)[number];

// ── Mock data (replace with DB queries) ───────────────────────────────────────

const MOCK_COMMITMENTS: Commitment[] = [
  {
    id: "CMT-ABC123",
    type: "Safe",
    status: "Active",
    asset: "XLM",
    amount: "50000",
    complianceScore: 95,
    daysRemaining: 15,
    createdAt: "2026-01-10T00:00:00Z",
  },
  {
    id: "CMT-XYZ789",
    type: "Balanced",
    status: "Active",
    asset: "USDC",
    amount: "100000",
    complianceScore: 88,
    daysRemaining: 42,
    createdAt: "2025-12-15T00:00:00Z",
  },
  {
    id: "CMT-DEF456",
    type: "Aggressive",
    status: "Active",
    asset: "XLM",
    amount: "250000",
    complianceScore: 76,
    daysRemaining: 75,
    createdAt: "2025-11-20T00:00:00Z",
  },
  {
    id: "CMT-GHI012",
    type: "Safe",
    status: "Settled",
    asset: "XLM",
    amount: "75000",
    complianceScore: 97,
    daysRemaining: 0,
    createdAt: "2025-12-01T00:00:00Z",
  },
  {
    id: "CMT-JKL345",
    type: "Balanced",
    status: "Early Exit",
    asset: "USDC",
    amount: "150000",
    complianceScore: 72,
    daysRemaining: 0,
    createdAt: "2025-11-01T00:00:00Z",
  },
  {
    id: "CMT-MNO678",
    type: "Aggressive",
    status: "Violated",
    asset: "XLM",
    amount: "200000",
    complianceScore: 45,
    daysRemaining: 0,
    createdAt: "2025-10-15T00:00:00Z",
  },
  {
    id: "CMT-PQR901",
    type: "Safe",
    status: "Active",
    asset: "XLM",
    amount: "30000",
    complianceScore: 92,
    daysRemaining: 20,
    createdAt: "2026-01-20T00:00:00Z",
  },
  {
    id: "CMT-STU234",
    type: "Balanced",
    status: "Active",
    asset: "USDC",
    amount: "80000",
    complianceScore: 85,
    daysRemaining: 33,
    createdAt: "2026-01-05T00:00:00Z",
  },
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
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = req.ip ?? req.headers.get("x-forwarded-for") ?? "anonymous";
  const isAllowed = await checkRateLimit(ip, "api/commitments");

  if (!isAllowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);

  try {
    const pagination = parsePaginationParams(searchParams, {
      defaultPageSize: 10,
    });
    const { sortBy, sortOrder } = parseSortParams<CommitmentSortField>(
      searchParams,
      SORT_FIELDS,
      "createdAt",
      "desc",
    );
    const typeFilter = parseEnumFilter(searchParams, "type", COMMITMENT_TYPES);
    const statusFilter = parseEnumFilter(
      searchParams,
      "status",
      COMMITMENT_STATUSES,
    );

    let results = MOCK_COMMITMENTS;
    if (typeFilter) results = results.filter((c) => c.type === typeFilter);
    if (statusFilter)
      results = results.filter((c) => c.status === statusFilter);

    results = [...results].sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      const numA =
        typeof valA === "string" ? parseFloat(valA) : (valA as number);
      const numB =
        typeof valB === "string" ? parseFloat(valB) : (valB as number);
      return sortOrder === "asc" ? numA - numB : numB - numA;
    });

    return NextResponse.json({
      success: true,
      data: paginateArray(results, pagination),
    });
  } catch (err) {
    if (err instanceof PaginationParseError)
      return paginationErrorResponse(err);
    console.error("[GET /api/commitments] Unhandled error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      },
      { status: 500 },
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.ip ?? req.headers.get("x-forwarded-for") ?? "anonymous";

  const isAllowed = await checkRateLimit(ip, "api/commitments");
  if (!isAllowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  logInfo(req, "Creating commitment", { ip });

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.title || !body.amount) {
      return NextResponse.json(
        { error: 'Missing required fields: title, amount' },
        { status: 400 }
      )
    }

    // Mock Soroban contract interaction
    // In production, this would invoke the actual contract
    const newCommitment: CommitmentData = {
      id: randomUUID(),
      title: body.title,
      amount: body.amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json(newCommitment, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to create commitment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
    const body = (await req.json()) as CreateCommitmentRequestBody;
    const result = await createCommitmentOnChain({
      ownerAddress: body.ownerAddress,
      asset: body.asset,
      amount: body.amount,
      durationDays: body.durationDays,
      maxLossBps: body.maxLossBps,
      metadata: body.metadata,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const normalized = normalizeBackendError(error, {
      code: "INTERNAL_ERROR",
      message: "Failed to create commitment.",
      status: 500,
    });
    return NextResponse.json(toBackendErrorResponse(normalized), {
      status: normalized.status,
    });
  }
}
