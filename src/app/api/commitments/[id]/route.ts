import { NextRequest, NextResponse } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { BackendError, normalizeBackendError, NotFoundError, toBackendErrorResponse } from '@/lib/backend/errors';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { contractAddresses } from '@/utils/soroban';

function getDaysRemaining(expiresAt: string | undefined): number | null {
  if (!expiresAt) return null;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return null;
  return Math.max(0, Math.ceil((expiresAtMs - Date.now()) / (24 * 60 * 60 * 1000)));
}

function getNftMetadataLink(commitmentId: string): string | null {
  const nftContract = contractAddresses.commitmentNFT;
  return nftContract ? `${nftContract}/metadata/${commitmentId}` : null;
}

const COMMITMENT_DETAIL_CORS_POLICY = {
  GET: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_DETAIL_CORS_POLICY);

export const GET = withApiHandler(async (_req: NextRequest, context, correlationId) => {
  const commitmentId = context.params.id;

  let commitment: any;
  try {
    commitment = await getCommitmentFromChain(commitmentId);
  } catch (err) {
    if (err instanceof BackendError && err.code === 'NOT_FOUND') {
      throw new NotFoundError('Commitment', { commitmentId });
    }

    const normalized = normalizeBackendError(err, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Unable to fetch commitment from chain.',
      status: 502,
      details: { commitmentId },
    });
    return NextResponse.json(toBackendErrorResponse(normalized), { status: normalized.status });
  }

  if (!commitment || !(commitment.id ?? commitment.commitmentId)) {
    throw new NotFoundError('Commitment', { commitmentId });
  }

  return ok(
    {
      commitmentId: String(commitment.id ?? commitment.commitmentId),
      owner: commitment.ownerAddress ?? commitment.owner,
      rules: commitment.rules ?? null,
      amount: typeof commitment.amount === 'bigint' ? String(commitment.amount) : commitment.amount,
      asset: commitment.asset,
      createdAt: commitment.createdAt,
      expiresAt: commitment.expiresAt,
      currentValue:
        typeof commitment.currentValue === 'bigint'
          ? String(commitment.currentValue)
          : commitment.currentValue,
      status: commitment.status,
      daysRemaining: getDaysRemaining(commitment.expiresAt),
      drawdownPercent: commitment.drawdownPercent ?? null,
      maxLossPercent: commitment.rules?.maxLossPercent ?? null,
      tokenId: commitment.tokenId ?? null,
      nftMetadataLink: getNftMetadataLink(String(commitment.id ?? commitment.commitmentId)),
    },
    undefined,
    200,
    correlationId,
  );
}, { cors: COMMITMENT_DETAIL_CORS_POLICY });

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
