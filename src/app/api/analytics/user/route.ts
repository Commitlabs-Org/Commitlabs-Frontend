import { NextRequest, NextResponse } from 'next/server';
import { methodNotAllowed } from '@/lib/backend/apiResponse';
import {
  ChainCommitment,
  getUserCommitmentsFromChain
} from '@/lib/backend/services/contracts';
import {
  applyCorsPolicy,
  createCorsOptionsHandler,
  enforceCorsRequestPolicy,
  toCorsErrorResponse,
  type CorsRoutePolicy,
} from '@/lib/backend/cors';
import {
  BackendError,
  normalizeBackendError,
  toBackendErrorResponse
} from '@/lib/backend/errors';
import { isFeatureEnabled } from '@/lib/backend/config';

interface UserAnalyticsResponse {
  ownerAddress: string;
  totalCommitments: number;
  activeCommitments: number;
  totalValueCommitted: string;
  feesEarned: string;
  averageComplianceScore: number;
  violationCount: number;
}

const ANALYTICS_USER_CORS_POLICY = {
  GET: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(ANALYTICS_USER_CORS_POLICY);

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
  try {
    enforceCorsRequestPolicy(req, ANALYTICS_USER_CORS_POLICY);
  } catch (error) {
    return toCorsErrorResponse(error);
  }

  if (!isFeatureEnabled('analyticsUser')) {
    const error = new BackendError({
      code: 'NOT_FOUND',
      message: 'User analytics endpoint is disabled.',
      status: 404,
      details: { feature: 'analyticsUser' }
    });

    return applyCorsPolicy(
      req,
      NextResponse.json(toBackendErrorResponse(error), {
        status: error.status
      }),
      ANALYTICS_USER_CORS_POLICY
    );
  }

  const ownerAddress = req.nextUrl.searchParams.get('ownerAddress')?.trim();

  if (!ownerAddress) {
    const error = new BackendError({
      code: 'BAD_REQUEST',
      message: 'Query param ownerAddress is required.',
      status: 400
    });
    return applyCorsPolicy(
      req,
      NextResponse.json(toBackendErrorResponse(error), {
        status: error.status
      }),
      ANALYTICS_USER_CORS_POLICY
    );
  }

  try {
    const commitments = await getUserCommitmentsFromChain(ownerAddress);
    return applyCorsPolicy(
      req,
      NextResponse.json(buildUserAnalytics(ownerAddress, commitments)),
      ANALYTICS_USER_CORS_POLICY
    );
  } catch (error) {
    const normalized = normalizeBackendError(error, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to compute user analytics.',
      status: 500
    });

    return applyCorsPolicy(
      req,
      NextResponse.json(toBackendErrorResponse(normalized), {
        status: normalized.status
      }),
      ANALYTICS_USER_CORS_POLICY
    );
  }
}

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
