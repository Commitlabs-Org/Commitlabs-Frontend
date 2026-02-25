import { NextRequest, NextResponse } from 'next/server';
import {
  ChainCommitment,
  getUserCommitmentsFromChain
} from '@/lib/backend/services/contracts';
import {
  BackendError,
  normalizeBackendError,
  toBackendErrorResponse
} from '@/lib/backend/errors';

interface UserAnalyticsResponse {
  ownerAddress: string;
  totalCommitments: number;
  activeCommitments: number;
  totalValueCommitted: string;
  feesEarned: string;
  averageComplianceScore: number;
  violationCount: number;
}

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

function buildUserAnalytics(
  ownerAddress: string,
  commitments: ChainCommitment[]
): UserAnalyticsResponse {
  const totalCommitments = commitments.length;
  const activeCommitments = commitments.filter(
    (commitment) => commitment.status === 'ACTIVE'
  ).length;
  const averageComplianceScore =
    totalCommitments === 0
      ? 0
      : commitments.reduce(
          (acc, commitment) => acc + commitment.complianceScore,
          0
        ) / totalCommitments;
  const violationCount = commitments.reduce(
    (acc, commitment) => acc + commitment.violationCount,
    0
  );

  return {
    ownerAddress,
    totalCommitments,
    activeCommitments,
    totalValueCommitted: sumNumericStringField(commitments, 'amount'),
    feesEarned: sumNumericStringField(commitments, 'feeEarned'),
    averageComplianceScore: Number(averageComplianceScore.toFixed(2)),
    violationCount
  };
}

export async function GET(req: NextRequest) {
  const ownerAddress = req.nextUrl.searchParams.get('ownerAddress')?.trim();

  if (!ownerAddress) {
    const error = new BackendError({
      code: 'BAD_REQUEST',
      message: 'Query param ownerAddress is required.',
      status: 400
    });
    return NextResponse.json(toBackendErrorResponse(error), {
      status: error.status
    });
  }

  try {
    const commitments = await getUserCommitmentsFromChain(ownerAddress);
    return NextResponse.json(buildUserAnalytics(ownerAddress, commitments));
  } catch (error) {
    const normalized = normalizeBackendError(error, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to compute user analytics.',
      status: 500
    });

    return NextResponse.json(toBackendErrorResponse(normalized), {
      status: normalized.status
    });
  }
}
