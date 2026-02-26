import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/response';
import { TooManyRequestsError, ValidationError } from '@/lib/backend/errors';
import { logInfo } from '@/lib/backend/logger';
import {
    parsePaginationParams,
    paginateArray,
    PaginationParseError,
    paginationErrorResponse
} from '@/lib/backend/pagination';
import {
    recordAttestationOnChain,
    RecordAttestationOnChainParams
} from '@/lib/backend/services/contracts';

// ── Types ─────────────────────────────────────────────────────────────────────

const ATTESTATION_TYPES = [
  'health_check',
  'violation',
  'fee_generation',
  'drawdown',
] as const;

export type AttestationType = (typeof ATTESTATION_TYPES)[number];

interface RecordAttestationRequestBody {
  commitmentId: string;
  attestationType: AttestationType;
  data: Record<string, unknown>;
  verifiedBy: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAttestationType(value: unknown): value is AttestationType {
  return typeof value === 'string' && ATTESTATION_TYPES.includes(value as AttestationType);
}

function parseAndValidateBody(raw: unknown): RecordAttestationRequestBody {
    const body = raw as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
        throw new ValidationError('Request body must be a JSON object.');
    }

    const { commitmentId, attestationType, data, verifiedBy } = body;

    if (typeof commitmentId !== 'string' || !commitmentId) throw new ValidationError('commitmentId is required');
    if (!isAttestationType(attestationType)) throw new ValidationError('Invalid attestationType');
    if (!data || typeof data !== 'object') throw new ValidationError('data object is required');
    if (typeof verifiedBy !== 'string' || !verifiedBy) throw new ValidationError('verifiedBy is required');

    return {
        commitmentId,
        attestationType,
        data: data as Record<string, unknown>,
        verifiedBy
    };
}

function mapToRecordParams(body: RecordAttestationRequestBody): RecordAttestationOnChainParams {
    const { commitmentId, attestationType, data, verifiedBy } = body;
    const timestamp = new Date().toISOString();
    
    let complianceScore = 0;
    let violation = false;
    let feeEarned: string | undefined;

    // Simplified mapping logic based on previous code
    if (attestationType === 'health_check') {
        complianceScore = Number(data.complianceScore) || 0;
        violation = Boolean(data.violation);
    } else if (attestationType === 'violation') {
        violation = true;
    } else if (attestationType === 'fee_generation') {
        feeEarned = String(data.feeEarned || data.amount || '0');
    }

    return {
        commitmentId,
        attestorAddress: verifiedBy,
        complianceScore,
        violation,
        feeEarned,
        timestamp,
        details: { type: attestationType, ...data },
    };
}

// ── GET Handler ───────────────────────────────────────────────────────────────

export const GET = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
    const isAllowed = await checkRateLimit(ip, 'api/attestations');

    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    const { searchParams } = new URL(req.url);

    try {
        const pagination = parsePaginationParams(searchParams, { defaultPageSize: 10 });
        
        // Mock data
        const attestations = [
            { id: '1', commitmentId: '123', attester: 'GABC...', rating: 5, comment: 'Great commitment!' },
        ];

        return ok(paginateArray(attestations, pagination));
    } catch (err) {
        if (err instanceof PaginationParseError) return paginationErrorResponse(err);
        throw err;
    }
});

// ── POST Handler ──────────────────────────────────────────────────────────────

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
    const isAllowed = await checkRateLimit(ip, 'api/attestations');

    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    let body: RecordAttestationRequestBody;
    try {
        const raw = await req.json();
        body = parseAndValidateBody(raw);
    } catch (err) {
        if (err instanceof ValidationError) throw err;
        throw new ValidationError('Invalid JSON in request body.');
    }

    logInfo(req, 'Recording attestation', { commitmentId: body.commitmentId });

    const params = mapToRecordParams(body);
    const result = await recordAttestationOnChain(params);

    return ok({
        attestation: result,
        txReference: result.txHash ?? null,
    }, 201);
});
