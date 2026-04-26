import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
  getCommitmentFromChain,
  recordAttestationOnChain,
} from '@/lib/backend/services/contracts';
import {
  normalizeBackendError,
  toBackendErrorResponse,
  ApiError,
  ValidationError,
  TooManyRequestsError,
} from '@/lib/backend/errors';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { parseJsonWithLimit, JSON_BODY_LIMITS } from '@/lib/backend/jsonBodyLimit';
import { getMockData } from '@/lib/backend/mockDb';
import {
  validateAttestationData,
  type AttestationData,
} from '@/lib/backend/attestationSchemas';
import { ATTESTATION_TYPES } from '@/lib/types/domain';
import type { AttestationType } from '@/lib/types/domain';
import type { RecordAttestationOnChainParams } from '@/lib/backend/services/contracts';

export type { AttestationType };

function isAttestationType(value: unknown): value is AttestationType {
  return typeof value === 'string' && (ATTESTATION_TYPES as readonly string[]).includes(value);
}

export interface RecordAttestationRequestBody {
  commitmentId: string;
  attestationType: AttestationType;
  /** Validated and normalised — only allowlisted keys for the given type. */
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
    throw new ValidationError(
      `Invalid attestationType. Must be one of: ${ATTESTATION_TYPES.join(', ')}.`,
      { field: 'attestationType', allowed: ATTESTATION_TYPES },
    );
  }

  if (body.data === null || body.data === undefined || typeof body.data !== 'object' || Array.isArray(body.data)) {
    throw new ValidationError('Field "data" must be an object.', { field: 'data' });
  }

  // Validate data against the per-type allowlisted schema
  let data: AttestationData;
  try {
    data = validateAttestationData(attestationType, body.data);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'PAYLOAD_TOO_LARGE') {
      throw new ValidationError((err as Error).message, { field: 'data' });
    }
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      const fieldPath = ['data', ...first.path].join('.');
      throw new ValidationError(first.message, { field: fieldPath, issues: err.issues });
    }
    throw err;
  }

  const verifiedBy = ensureNonEmptyString(body.verifiedBy, 'verifiedBy');

  return { commitmentId, attestationType, data, verifiedBy };
}

function mapToRecordParams(
  body: RecordAttestationRequestBody,
): RecordAttestationOnChainParams {
  const { commitmentId, attestationType, data, verifiedBy } = body;
  const timestamp = new Date().toISOString();

  // All fields are now guaranteed to be valid and normalised by the schema.
  const d = data as Record<string, unknown>;

  let complianceScore = 0;
  let violation = false;
  let feeEarned: string | undefined;

  if (attestationType === 'health_check') {
    complianceScore = d.complianceScore as number;
    violation = (d.violation as boolean) ?? false;
  } else if (attestationType === 'violation') {
    violation = true;
    complianceScore = typeof d.complianceScore === 'number' ? (d.complianceScore as number) : 0;
  } else if (attestationType === 'fee_generation') {
    feeEarned = d.feeEarned as string; // already coerced to string by schema
    complianceScore = typeof d.complianceScore === 'number' ? (d.complianceScore as number) : 0;
  } else {
    // drawdown
    complianceScore = typeof d.complianceScore === 'number' ? (d.complianceScore as number) : 0;
  }

  return {
    commitmentId,
    attestorAddress: verifiedBy,
    complianceScore,
    violation,
    feeEarned,
    timestamp,
    details: { type: attestationType, ...d },
  };
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
  const isAllowed = await checkRateLimit(ip, 'api/attestations');
  if (!isAllowed) throw new TooManyRequestsError();

  const { attestations } = await getMockData();
  return ok({ attestations }, 200);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
  const isAllowed = await checkRateLimit(ip, 'api/attestations');
  if (!isAllowed) throw new TooManyRequestsError();

  let body: RecordAttestationRequestBody;
  try {
    const raw = await parseJsonWithLimit(req, {
      limitBytes: JSON_BODY_LIMITS.attestationsCreate,
    });
    body = parseAndValidateBody(raw);
  } catch (err) {
    // Preserve 413 / 400 / other ApiError semantics; only generic failures
    // are remapped to a 400 "Invalid JSON" error.
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

  const params = mapToRecordParams(body);

  try {
    const result = await recordAttestationOnChain(params);
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
      201,
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
});

const _405 = methodNotAllowed(['GET', 'POST']);
export { _405 as PUT, _405 as PATCH, _405 as DELETE };
});
