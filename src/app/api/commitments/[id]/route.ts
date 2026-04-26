import { NextRequest } from 'next/server';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { NotFoundError } from '@/lib/backend/errors';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { contractAddresses } from '@/utils/soroban';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysRemaining(expiresAt: string | undefined): number | null {
  if (!expiresAt) return null;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAtMs - Date.now()) / msPerDay));
}

function getNftMetadataLink(commitmentId: string): string | null {
  const nftContract = contractAddresses.commitmentNFT;
  if (!nftContract) return null;
  return `${nftContract}/metadata/${commitmentId}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const GET = withApiHandler(async (
    _req: NextRequest,
    context: { params: Record<string, string> },
    correlationId: string
) => {
  const commitmentId = context.params.id;

  let commitment;
  try {
    commitment = await getCommitmentFromChain(commitmentId);
  } catch (err) {
    // Distinguish a known "not found" BackendError from a generic upstream failure
    if (err instanceof BackendError && err.code === 'NOT_FOUND') {
      throw new NotFoundError('Commitment', { commitmentId });
    }

    // All other upstream failures → 502
    const normalized = normalizeBackendError(err, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Unable to fetch commitment from chain.',
      status: 502,
      details: { commitmentId },
    });
    return NextResponse.json(toBackendErrorResponse(normalized), {
      status: normalized.status,
    });
  }

    return ok(response, undefined, 200, correlationId);
});

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
