import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError, NotFoundError, ConflictError, ForbiddenError } from '@/lib/backend/errors';
import { settleCommitmentOnChain } from '@/lib/backend/services/contracts';
import { logCommitmentSettled } from '@/lib/backend/logger';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';

const SetteRequestWithAuthSchema = z.object({
    actorAddress: z.string().min(1, 'Actor address is required'),
    callerAddress: z.string().optional(),
});

interface Params {
    params: { id: string };
}

export const POST = withApiHandler(async (req: NextRequest, { params }: Params) => {
    const { id } = params;
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/commitments/settle');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    if (!id || id.trim().length === 0) {
        throw new ValidationError('Commitment ID is required');
    }

    let body;
    try {
        body = await req.json();
    } catch {
        throw new ValidationError('Invalid JSON in request body');
    }

    const authValidation = SetteRequestWithAuthSchema.safeParse(body);
    if (!authValidation.success) {
        throw new ValidationError('Invalid request data', authValidation.error.errors);
    }

    const { actorAddress, callerAddress } = authValidation.data;

    const commitment = await getCommitmentFromChain(id);

    if (commitment.ownerAddress.toLowerCase() !== actorAddress.toLowerCase()) {
        throw new ForbiddenError('You do not own this commitment');
    }

    if (commitment.status === 'SETTLED') {
        throw new ConflictError('Commitment has already been settled');
    }

    if (commitment.status === 'VIOLATED') {
        throw new ConflictError('Commitment has been violated and cannot be settled');
    }

    if (commitment.status === 'EARLY_EXIT') {
        throw new ConflictError('Commitment has already been exited early');
    }

    if (commitment.status === 'ACTIVE' && commitment.expiresAt) {
        const expiryTime = new Date(commitment.expiresAt).getTime();
        const now = new Date().getTime();
        if (now < expiryTime) {
            throw new ValidationError('Commitment has not matured yet and cannot be settled', {
                currentStatus: commitment.status,
                expiresAt: commitment.expiresAt,
            });
        }
    }

    try {
        const settlementResult = await settleCommitmentOnChain({
            commitmentId: id,
            callerAddress,
        });

        logCommitmentSettled({
            ip,
            commitmentId: id,
            callerAddress,
            settlementAmount: settlementResult.settlementAmount,
            finalStatus: settlementResult.finalStatus,
            txHash: settlementResult.txHash,
        });

        return ok({
            commitmentId: id,
            settlementAmount: settlementResult.settlementAmount,
            finalStatus: settlementResult.finalStatus,
            txHash: settlementResult.txHash,
            reference: settlementResult.reference,
            settledAt: new Date().toISOString(),
        });

    } catch (error) {
        logCommitmentSettled({
            ip,
            commitmentId: id,
            callerAddress,
            error: error instanceof Error ? error.message : 'Unknown settlement error',
        });

        if (
            error instanceof ValidationError ||
            error instanceof NotFoundError ||
            error instanceof ConflictError ||
            error instanceof ForbiddenError
        ) {
            throw error;
        }

        throw error;
    }
});