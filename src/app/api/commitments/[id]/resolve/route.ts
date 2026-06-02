import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError, ConflictError, ForbiddenError } from '@/lib/backend/errors';
import { getClientIp } from '@/lib/backend/getClientIp';
import { resolveDisputeOnChain } from '@/lib/backend/services/contracts';
import { logDisputeResolved } from '@/lib/backend/logger';
import { recordAuditEvent } from '@/lib/backend/auditLog';
import { requireAdmin } from '@/lib/backend/requireAuth';

const ResolveDisputeRequestSchema = z.object({
    resolution: z.enum(['resolved_in_favor_of_owner', 'resolved_in_favor_of_counterparty', 'dismissed']),
    notes: z.string().max(1000).optional(),
});

interface Params {
    params: { id: string };
}

export const POST = withApiHandler(async (req: NextRequest, { params }: Params) => {
    const { id } = params;
    const ip = getClientIp(req);

    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, 'api/commitments/resolve');
    if (!allowed) {
        throw new TooManyRequestsError(undefined, undefined, retryAfterSeconds);
    }

    if (!id || id.trim().length === 0) {
        throw new ValidationError('Commitment ID is required');
    }

    const admin = requireAdmin(req);

    let body;
    try {
        body = await req.json();
    } catch {
        throw new ValidationError('Invalid JSON in request body');
    }

    const validation = ResolveDisputeRequestSchema.safeParse(body);
    if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.errors);
    }

    const { resolution, notes } = validation.data;

    try {
        const resolveResult = await resolveDisputeOnChain({
            commitmentId: id,
            resolution,
            notes,
            resolverAddress: admin.address,
        });

        logDisputeResolved({
            ip,
            commitmentId: id,
            resolution,
            resolverAddress: admin.address,
            disputeId: resolveResult.disputeId,
            txHash: resolveResult.txHash,
        });

        recordAuditEvent({
            eventType: 'DISPUTE_RESOLVED',
            actorAddress: admin.address,
            commitmentId: id,
            details: {
                resolution,
                notes: notes ?? '',
                disputeId: resolveResult.disputeId,
                txHash: resolveResult.txHash,
            },
        });

        return ok({
            commitmentId: id,
            disputeId: resolveResult.disputeId,
            resolution: resolveResult.resolution,
            finalStatus: resolveResult.finalStatus,
            txHash: resolveResult.txHash,
            resolvedAt: resolveResult.resolvedAt,
        });
    } catch (error) {
        logDisputeResolved({
            ip,
            commitmentId: id,
            resolution,
            resolverAddress: admin.address,
            error: error instanceof Error ? error.message : 'Unknown resolution error',
        });

        if (
            error instanceof ValidationError ||
            error instanceof ConflictError ||
            error instanceof ForbiddenError
        ) {
            throw error;
        }

        throw error;
    }
});
