import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError } from '@/lib/backend/errors';
import { getBackendConfig } from '@/lib/backend/config';
import { earlyExitCommitmentOnChain } from '@/lib/backend/contracts';
import { parseEarlyExitInput } from '@/lib/backend/validation';

export const POST = withApiHandler(
    async (req: NextRequest, context: { params: Record<string, string> }) => {
        const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

        const isAllowed = await checkRateLimit(ip, 'api/commitments/early-exit');
        if (!isAllowed) {
            throw new TooManyRequestsError();
        }

        const commitmentId = context.params.id;
        if (!commitmentId) {
            throw new ValidationError('Route parameter id is required.');
        }

        const input = await parseEarlyExitInput(req);
        const config = getBackendConfig();
        const chainResult = await earlyExitCommitmentOnChain(config, commitmentId, input);

        return ok({
            commitmentId,
            penaltyAmount: chainResult.penaltyAmount,
            returnedAmount: chainResult.returnedAmount,
            txHash: chainResult.txHash ?? null,
            reference: chainResult.reference ?? null,
        });
    }
);
