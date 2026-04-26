import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError, NotFoundError, ConflictError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { settleCommitmentOnChain } from '@/lib/backend/services/contracts';
import { logCommitmentSettled } from '@/lib/backend/logger';

const SettleRequestSchema = z.object({
    callerAddress: z.string().optional(),
});

interface Params {
    params: { id: string };
}

export const POST = withApiHandler(async (req: NextRequest, { params }: Params) => {
    const { id } = params;
    const ip = getClientIp(req);

    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, 'api/commitments/settle');
    if (!allowed) {
        throw new TooManyRequestsError(undefined, undefined, retryAfterSeconds);
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

    const validation = SettleRequestSchema.safeParse(body);
    if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.errors);
    }

    const { callerAddress } = validation.data;

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
            error instanceof ConflictError
        ) {
            throw error;
        }

        throw error;
    }
});
