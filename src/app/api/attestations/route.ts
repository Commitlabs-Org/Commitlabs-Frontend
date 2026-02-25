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
import { getMockData } from '@/lib/backend/mockDb';

export const GET = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/attestations');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    const { attestations } = await getMockData();

    return ok({ attestations }, 200);
});
import { logAttestation } from '@/lib/backend/logger';
import { mapAttestationFromChain } from '@/lib/backend/dto';

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

    // TODO(issue-126): Enforce validateSession(req) per docs/backend-session-csrf.md before mutating state.
    // TODO(issue-126): Enforce CSRF validation for browser cookie-auth requests (token + origin checks).
    // TODO: verify on-chain data, store attestation in database, etc.

    return ok({ message: 'Attestation recorded successfully.' }, 201);
});
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const attestation = mapAttestationFromChain({
        id: (body.attestationId as string | undefined) ?? `att_${Date.now()}`,
        commitmentId: (body.commitmentId as string | undefined) ?? 'unknown',
        ownerAddress: (body.ownerAddress as string | undefined) ?? 'unknown',
        kind: (body.kind as string | undefined) ?? 'compliance',
        verdict: body.verdict as string | undefined,
        observedAt: body.observedAt as string | number | Date | undefined,
        details: body.details,
    });

    return ok({ attestation }, 201);
});
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

    // analytics hook
    try {
        const body = await req.json();
        logAttestation({ ip, ...body });
    } catch (e) {
        logAttestation({ ip, error: 'failed to parse request body' });
    }

    return ok({ message: 'Attestation recorded successfully.' }, 201);
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
