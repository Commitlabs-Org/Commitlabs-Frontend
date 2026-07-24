import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError, NotFoundError, ConflictError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { openDisputeOnChain } from '@/lib/backend/services/contracts';
import { logDisputeOpened } from '@/lib/backend/logger';
import { recordAuditEvent } from '@/lib/backend/auditLog';

const DisputeRequestSchema = z.object({
    reason: z.string().min(1, 'Dispute reason is required').max(500),
    evidence: z.string().optional(),
    callerAddress: z.string().optional(),
});

interface Params {
    params: { id: string };
}

export const POST = withApiHandler(async (req: NextRequest, { params }: Params) => {
    const { id } = params;
    const ip = getClientIp(req);

    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, 'api/commitments/dispute');
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

    const validation = DisputeRequestSchema.safeParse(body);
    if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.errors);
    }

    const { reason, evidence, callerAddress } = validation.data;

    try {
        const disputeResult = await openDisputeOnChain({
            commitmentId: id,
            reason,
            evidence,
            callerAddress: callerAddress ?? '',
        });

        logDisputeOpened({
            ip,
            commitmentId: id,
            reason,
            callerAddress,
            disputeId: disputeResult.disputeId,
            txHash: disputeResult.txHash,
        });

        recordAuditEvent({
            eventType: 'DISPUTE_OPENED',
            actorAddress: callerAddress ?? '',
            commitmentId: id,
            details: {
                reason,
                evidence: evidence ?? '',
                disputeId: disputeResult.disputeId,
                txHash: disputeResult.txHash,
            },
        });

        return ok({
            commitmentId: id,
            disputeId: disputeResult.disputeId,
            status: disputeResult.status,
            txHash: disputeResult.txHash,
            disputedAt: disputeResult.disputedAt,
        });
    } catch (error) {
        logDisputeOpened({
            ip,
            commitmentId: id,
            reason,
            callerAddress,
            error: error instanceof Error ? error.message : 'Unknown dispute error',
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
