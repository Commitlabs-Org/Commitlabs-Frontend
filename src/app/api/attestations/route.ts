import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, methodNotAllowed } from '@/lib/backend/apiResponse';
import { validateAttestationData, type AttestationData } from '@/lib/backend/attestationSchemas';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import {
  ApiError,
  TooManyRequestsError,
  ValidationError,
  normalizeBackendError,
  toBackendErrorResponse,
} from '@/lib/backend/errors';
import { parseJsonWithLimit, JSON_BODY_LIMITS } from '@/lib/backend/jsonBodyLimit';
import { getMockData } from '@/lib/backend/mockDb';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
  getCommitmentFromChain,
  recordAttestationOnChain,
  type RecordAttestationOnChainParams,
} from '@/lib/backend/services/contracts';
import { validateStellarAddress } from '@/lib/backend/validation';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ATTESTATION_TYPES, type AttestationType } from '@/lib/types/domain';

export type { AttestationType };

const ATTESTATIONS_CORS_POLICY = {
  GET: { access: 'public' },
  POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(ATTESTATIONS_CORS_POLICY);

function isAttestationType(value: unknown): value is AttestationType {
  return typeof value === 'string' && (ATTESTATION_TYPES as readonly string[]).includes(value);
}

interface RecordAttestationRequestBody {
  commitmentId: string;
  attestationType: AttestationType;
  data: AttestationData;
  verifiedBy: string;
}

function ensureNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`Field "${field}" must be a non-empty string.`, { field });
  }

  return value.trim();
}

function parseAndValidateBody(raw: unknown): RecordAttestationRequestBody {
  const body = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!body) {
    throw new ValidationError('Request body must be a JSON object.');
  }

  const commitmentId = ensureNonEmptyString(body.commitmentId, 'commitmentId');
  const attestationType = body.attestationType;
  if (!isAttestationType(attestationType)) {
    throw new ValidationError(`Invalid attestationType. Must be one of: ${ATTESTATION_TYPES.join(', ')}.`);
  }

  if (body.data === null || body.data === undefined || typeof body.data !== 'object' || Array.isArray(body.data)) {
    throw new ValidationError('Field "data" must be an object.', { field: 'data' });
  }

  let data: AttestationData;
  try {
    data = validateAttestationData(attestationType, body.data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ValidationError('Invalid attestation data.', { issues: err.issues });
    }
    throw err;
  }

  const verifiedBy = ensureNonEmptyString(body.verifiedBy, 'verifiedBy');
  return { commitmentId, attestationType, data, verifiedBy };
}

function mapToRecordParams(body: RecordAttestationRequestBody): RecordAttestationOnChainParams {
  const details = body.data as Record<string, unknown>;
  const complianceScore =
    typeof details.complianceScore === 'number' ? details.complianceScore : 0;
  const violation =
    body.attestationType === 'violation' || details.violation === true;
  const feeEarned =
    typeof details.feeEarned === 'string' ? details.feeEarned : undefined;

  return {
    commitmentId: body.commitmentId,
    attestorAddress: body.verifiedBy,
    complianceScore,
    violation,
    feeEarned,
    timestamp: new Date().toISOString(),
    details: { type: body.attestationType, ...details },
  };
}

export const GET = withApiHandler(async (_req: NextRequest, _context, correlationId) => {
  if (!(await checkRateLimit('anonymous', 'api/attestations'))) {
    throw new TooManyRequestsError();
  }

  const { attestations } = await getMockData();
  return ok({ attestations }, undefined, 200, correlationId);
}, { cors: ATTESTATIONS_CORS_POLICY });

export const POST = withApiHandler(async (req: NextRequest, _context, correlationId) => {
  if (!(await checkRateLimit('anonymous', 'api/attestations'))) {
    throw new TooManyRequestsError();
  }

  let body: RecordAttestationRequestBody;
  try {
    const raw = await parseJsonWithLimit(req, {
      limitBytes: JSON_BODY_LIMITS.attestationsCreate,
    });
    body = parseAndValidateBody(raw);
    validateStellarAddress(body.verifiedBy, 'verifiedBy');
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ValidationError('Invalid JSON in request body.');
  }

  try {
    await getCommitmentFromChain(body.commitmentId);
  } catch (err) {
    const normalized = normalizeBackendError(err, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Invalid commitment or unable to fetch commitment from chain.',
      status: 502,
      details: { commitmentId: body.commitmentId },
    });
    return NextResponse.json(toBackendErrorResponse(normalized), { status: normalized.status });
  }

  try {
    const result = await recordAttestationOnChain(mapToRecordParams(body));
    return ok(
      {
        attestation: {
          attestationId: result.attestationId,
          commitmentId: result.commitmentId,
          complianceScore: result.complianceScore,
          violation: result.violation,
          feeEarned: result.feeEarned,
          recordedAt: result.recordedAt,
        },
        txReference: result.txHash ?? null,
      },
      undefined,
      201,
      correlationId,
    );
  } catch (err) {
    const normalized = normalizeBackendError(err, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Failed to record attestation on chain.',
      status: 502,
      details: { commitmentId: body.commitmentId, attestationType: body.attestationType },
    });
    return NextResponse.json(toBackendErrorResponse(normalized), { status: normalized.status });
  }
}, { cors: ATTESTATIONS_CORS_POLICY });

const _405 = methodNotAllowed(['GET', 'POST']);
export { _405 as PUT, _405 as PATCH, _405 as DELETE };
