import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { recordAttestationOnChain } from '@/lib/backend/services/contracts';
import {
    normalizeBackendError,
    toBackendErrorResponse
} from '@/lib/backend/errors';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';

interface RecordAttestationRequestBody {
    commitmentId: string;
    attestorAddress: string;
    complianceScore: number;
    violation: boolean;
    feeEarned?: string;
    timestamp?: string;
    details?: Record<string, unknown>;
}


export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/attestations');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    try {
        const body = (await req.json()) as RecordAttestationRequestBody;
        const result = await recordAttestationOnChain({
            commitmentId: body.commitmentId,
            attestorAddress: body.attestorAddress,
            complianceScore: body.complianceScore,
            violation: body.violation,
            feeEarned: body.feeEarned,
            timestamp: body.timestamp,
            details: body.details
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        const normalized = normalizeBackendError(error, {
            code: 'INTERNAL_ERROR',
            message: 'Failed to record attestation.',
            status: 500
        });

        return NextResponse.json(toBackendErrorResponse(normalized), {
            status: normalized.status
        });
    }
}
