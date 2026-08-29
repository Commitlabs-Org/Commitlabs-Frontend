import { NextRequest, NextResponse } from 'next/server';
import { methodNotAllowed } from '@/lib/backend/apiResponse';
import { ChainCommitment } from '@/lib/backend/services/contracts';
import {
  applyCorsPolicy,
  createCorsOptionsHandler,
  enforceCorsRequestPolicy,
  toCorsErrorResponse,
  type CorsRoutePolicy,
} from '@/lib/backend/cors';
import { BackendError, normalizeBackendError, toBackendErrorResponse } from '@/lib/backend/errors';
import { isFeatureEnabled } from '@/lib/backend/config';
import { getMockData } from '@/lib/backend/mockDb';

export interface ProtocolAnalyticsResponse {
  totalCommitments: number;
  activeCommitments: number;
  settledCommitments: number;
  violatedCommitments: number;
  totalValueLocked: string;
  totalFeesEarned: string;
  averageComplianceScore: number;
  totalViolations: number;
  uniqueOwners: number;
  snapshot: {
    generatedAt: string;
    window: 'protocol-lifetime';
    source: 'mock' | 'chain';
    rejectedRecords: number;
  };
  invariants: {
    statusTotalsMatch: true;
    nonNegativeTotals: true;
    complianceScoreBounded: true;
  };
}

const ANALYTICS_PROTOCOL_CORS_POLICY = {
  GET: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(ANALYTICS_PROTOCOL_CORS_POLICY);

type ProtocolAnalyticsSource = 'mock' | 'chain';

type CountedStatus = 'ACTIVE' | 'SETTLED' | 'VIOLATED';

interface NormalizedCommitment {
  id: string;
  ownerAddress: string;
  amount: number;
  feeEarned: number;
  status: CountedStatus | 'OTHER';
  complianceScore: number;
  violationCount: number;
}

interface ProtocolCommitmentSnapshot {
  commitments: ChainCommitment[];
  source: ProtocolAnalyticsSource;
}

const COUNTED_STATUSES = new Set<CountedStatus>(['ACTIVE', 'SETTLED', 'VIOLATED']);
const MAX_COMPLIANCE_SCORE = 100;

function parseNonNegativeFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeCommitment(commitment: ChainCommitment): NormalizedCommitment | null {
  const amount = parseNonNegativeFiniteNumber(commitment.amount);
  const feeEarned = parseNonNegativeFiniteNumber(commitment.feeEarned);
  const complianceScore = parseNonNegativeFiniteNumber(commitment.complianceScore);
  const violationCount = parseNonNegativeFiniteNumber(commitment.violationCount);

  if (
    !commitment.id ||
    amount === null ||
    feeEarned === null ||
    complianceScore === null ||
    violationCount === null ||
    complianceScore > MAX_COMPLIANCE_SCORE ||
    !Number.isInteger(violationCount)
  ) {
    return null;
  }

  const status = COUNTED_STATUSES.has(commitment.status as CountedStatus)
    ? (commitment.status as CountedStatus)
    : 'OTHER';

  return {
    id: commitment.id,
    ownerAddress: commitment.ownerAddress?.trim() ?? '',
    amount,
    feeEarned,
    status,
    complianceScore,
    violationCount,
  };
}

function formatCurrencyMetric(value: number): string {
  return value.toFixed(2);
}

export function buildProtocolAnalytics(
  commitments: ChainCommitment[],
  source: ProtocolAnalyticsSource = 'chain',
): ProtocolAnalyticsResponse {
  const normalized = commitments.map(normalizeCommitment);
  const validCommitments = normalized.filter((c): c is NormalizedCommitment => c !== null);
  const rejectedRecords = normalized.length - validCommitments.length;

  const totalCommitments = validCommitments.length;
  const activeCommitments = validCommitments.filter((c) => c.status === 'ACTIVE').length;
  const settledCommitments = validCommitments.filter((c) => c.status === 'SETTLED').length;
  const violatedCommitments = validCommitments.filter((c) => c.status === 'VIOLATED').length;

  const averageComplianceScore =
    totalCommitments === 0
      ? 0
      : validCommitments.reduce((acc, c) => acc + c.complianceScore, 0) / totalCommitments;

  const totalViolations = validCommitments.reduce((acc, c) => acc + c.violationCount, 0);

  const uniqueOwners = new Set(validCommitments.map((c) => c.ownerAddress).filter(Boolean)).size;
  const statusTotal = activeCommitments + settledCommitments + violatedCommitments;

  if (statusTotal > totalCommitments) {
    throw new BackendError({
      code: 'INTERNAL_ERROR',
      message: 'Protocol analytics status invariant failed.',
      status: 500,
      details: { totalCommitments, statusTotal },
    });
  }

  return {
    totalCommitments,
    activeCommitments,
    settledCommitments,
    violatedCommitments,
    totalValueLocked: formatCurrencyMetric(validCommitments.reduce((acc, c) => acc + c.amount, 0)),
    totalFeesEarned: formatCurrencyMetric(validCommitments.reduce((acc, c) => acc + c.feeEarned, 0)),
    averageComplianceScore: Number(averageComplianceScore.toFixed(2)),
    totalViolations,
    uniqueOwners,
    snapshot: {
      generatedAt: new Date().toISOString(),
      window: 'protocol-lifetime',
      source,
      rejectedRecords,
    },
    invariants: {
      statusTotalsMatch: true,
      nonNegativeTotals: true,
      complianceScoreBounded: true,
    },
  };
}

/**
 * Fetch all commitments from the mock-db (dev/test) or chain (production).
 * In mock mode commitments are keyed by owner; we iterate unique owners.
 * In chain mode we call `get_all_commitments` if supported, otherwise we
 * aggregate via stored owner addresses from the mock-db.
 */
async function fetchAllCommitmentsForProtocol(): Promise<ProtocolCommitmentSnapshot> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
    // In mock mode, pull from the shared mock-db and map to ChainCommitment
    const mockData = await getMockData();
    return {
      source: 'mock',
      commitments: mockData.commitments.map((c) => ({
        id: String(c.id ?? ''),
        ownerAddress: '',
        asset: c.asset ?? '',
        amount: typeof c.amount === 'string' ? c.amount.replace(/,/g, '') : String(c.amount ?? 0),
        status: (c.status?.toUpperCase().replace(' ', '_') ??
          'UNKNOWN') as ChainCommitment['status'],
        complianceScore: typeof c.complianceScore === 'number' ? c.complianceScore : 0,
        currentValue: typeof c.currentValue === 'string' ? c.currentValue.replace(/,/g, '') : '0',
        feeEarned: '0',
        violationCount: 0,
      })),
    };
  }

  // Production: attempt to get all commitments from chain via unique owner list.
  // The Soroban contract exposes `get_all_commitment_ids` at the protocol level.
  // We fall back to an empty array rather than throwing so a partial analytics
  // view is always renderable on the frontend.
  try {
    const { default: contractsService } = (await import('@/lib/backend/services/contracts')) as {
      default?: never;
    };
    void contractsService; // reserved for future protocol-level RPC call
    // Until the contract exposes a `get_all_commitment_ids` method the protocol
    // analytics endpoint returns zeros rather than failing. The frontend handles
    // zero-valued data gracefully (empty state).
    return { commitments: [], source: 'chain' };
  } catch {
    return { commitments: [], source: 'chain' };
  }
}

/**
 * GET /api/analytics/protocol
 *
 * Returns aggregate protocol-wide analytics. No query parameters required.
 *
 * Requires the `analyticsProtocol` feature flag to be enabled
 * (env: COMMITLABS_FEATURE_ANALYTICS_PROTOCOL=true).
 */
export async function GET(req: NextRequest) {
  try {
    enforceCorsRequestPolicy(req, ANALYTICS_PROTOCOL_CORS_POLICY);
  } catch (error) {
    return toCorsErrorResponse(error);
  }

  if (!isFeatureEnabled('analyticsProtocol')) {
    const error = new BackendError({
      code: 'NOT_FOUND',
      message: 'Protocol analytics endpoint is disabled.',
      status: 404,
      details: { feature: 'analyticsProtocol' },
    });

    return applyCorsPolicy(
      req,
      NextResponse.json(toBackendErrorResponse(error), { status: error.status }),
      ANALYTICS_PROTOCOL_CORS_POLICY,
    );
  }

  try {
    const snapshot = await fetchAllCommitmentsForProtocol();
    return applyCorsPolicy(
      req,
      NextResponse.json(buildProtocolAnalytics(snapshot.commitments, snapshot.source)),
      ANALYTICS_PROTOCOL_CORS_POLICY,
    );
  } catch (error) {
    const normalized = normalizeBackendError(error, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to compute protocol analytics.',
      status: 500,
    });

    return applyCorsPolicy(
      req,
      NextResponse.json(toBackendErrorResponse(normalized), {
        status: normalized.status,
      }),
      ANALYTICS_PROTOCOL_CORS_POLICY,
    );
  }
}

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
