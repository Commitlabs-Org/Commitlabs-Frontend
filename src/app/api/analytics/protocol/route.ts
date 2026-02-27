import { NextRequest, NextResponse } from 'next/server';
import {
  ChainCommitment,
  getUserCommitmentsFromChain,
} from '@/lib/backend/services/contracts';
import {
  BackendError,
  normalizeBackendError,
  toBackendErrorResponse,
} from '@/lib/backend/errors';
import { isFeatureEnabled } from '@/lib/backend/config';
import { ok, fail } from '@/lib/backend/apiResponse';

/**
 * Protocol-level analytics aggregating all commitments across the network.
 */
interface ProtocolAnalyticsResponse {
  totalCommitments: number;
  activeCommitments: number;
  violatedCommitments: number;
  settledCommitments: number;
  totalValueCommitted: string;
  averageDurationDays: number;
  averageComplianceScore: number;
  timestamp: string;
}

/**
 * Sums a numeric field across all commitments, handling string-to-number conversions.
 */
function sumNumericStringField(
  commitments: ChainCommitment[],
  field: 'amount' | 'feeEarned'
): string {
  const total = commitments.reduce((acc, commitment) => {
    const value = Number(commitment[field]);
    return Number.isFinite(value) ? acc + value : acc;
  }, 0);

  return total.toFixed(2);
}

/**
 * Builds protocol-level analytics from all commitments.
 * 
 * @param commitments - Array of all chain commitments
 * @returns Protocol analytics payload
 */
function buildProtocolAnalytics(commitments: ChainCommitment[]): ProtocolAnalyticsResponse {
  const totalCommitments = commitments.length;

  // Count commitments by status
  const activeCommitments = commitments.filter(
    (commitment) => commitment.status === 'ACTIVE'
  ).length;
  const violatedCommitments = commitments.filter(
    (commitment) => commitment.status === 'VIOLATED'
  ).length;
  const settledCommitments = commitments.filter(
    (commitment) => commitment.status === 'SETTLED'
  ).length;

  // Calculate average compliance score
  const averageComplianceScore =
    totalCommitments === 0
      ? 0
      : commitments.reduce(
          (acc, commitment) => acc + commitment.complianceScore,
          0
        ) / totalCommitments;

  // TODO: Calculate averageDurationDays from actual commitment data
  // when chain data structure includes duration or timestamps
  const averageDurationDays = 0;

  return {
    totalCommitments,
    activeCommitments,
    violatedCommitments,
    settledCommitments,
    totalValueCommitted: sumNumericStringField(commitments, 'amount'),
    averageDurationDays,
    averageComplianceScore: Number(averageComplianceScore.toFixed(2)),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Retrieves all commitments from the chain.
 * 
 * TODO: Implement getAllCommitmentsFromChain for protocol-level queries.
 * Current implementation uses a fallback approach:
 * - In production, this should query indexed on-chain data (e.g., Stellar subgraph, caching layer)
 * - For now, returns empty array to signal that data aggregation is not yet fully implemented
 */
async function getAllCommitmentsFromChain(): Promise<ChainCommitment[]> {
  // TODO: Replace with actual chain query once indexing is available
  // This would typically involve:
  // 1. Querying a Soroban contract method like "get_all_commitments"
  // 2. Using an on-chain indexer or off-chain cache
  // 3. Implementing pagination for large datasets
  return [];
}

export async function GET(req: NextRequest) {
  if (!isFeatureEnabled('analyticsProtocol')) {
    return fail(
      'NOT_FOUND',
      'Protocol analytics endpoint is disabled.',
      { feature: 'analyticsProtocol' },
      404
    );
  }

  try {
    const commitments = await getAllCommitmentsFromChain();
    const analytics = buildProtocolAnalytics(commitments);
    return ok(analytics);
  } catch (error) {
    const normalized = normalizeBackendError(error, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to compute protocol analytics.',
      status: 500,
    });

    return NextResponse.json(toBackendErrorResponse(normalized), {
      status: normalized.status,
    });
  }
}
