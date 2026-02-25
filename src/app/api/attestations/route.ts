import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { mapAttestationFromChain } from '@/lib/backend/dto';


export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/attestations');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

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
