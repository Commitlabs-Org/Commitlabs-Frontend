import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getBackendConfig } from '@/lib/backend/config';
import { createCommitmentOnChain } from '@/lib/backend/contracts';
import { parseCreateCommitmentInput } from '@/lib/backend/validation';
import { mapCommitmentFromChain } from '@/lib/backend/dto';

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/commitments');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    const input = await parseCreateCommitmentInput(req);
    const config = getBackendConfig();
    const chainResult = await createCommitmentOnChain(config, input);
    const commitment = mapCommitmentFromChain(chainResult.commitment);

    return ok(
        {
            commitmentId: chainResult.commitmentId,
            nftTokenId: chainResult.nftTokenId,
            txHash: chainResult.txHash ?? null,
            reference: chainResult.reference ?? null,
            commitment,
        },
        201
    );
});
