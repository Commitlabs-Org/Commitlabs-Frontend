import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
  getCommitmentFromChain,
  recordAttestationOnChain,
} from '@/lib/backend/services/contracts';
import {
  normalizeBackendError,
  toBackendErrorResponse,
  ValidationError,
} from '@/lib/backend/errors';
// src/app/api/attestations/route.ts
import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getMockData } from '@/lib/backend/mockDb';
import type { RecordAttestationOnChainParams } from '@/lib/backend/services/contracts';

const ATTESTATION_TYPES = [
  'health_check',
  'violation',
  'fee_generation',
  'drawdown',
] as const;

export type AttestationType = (typeof ATTESTATION_TYPES)[number];

function isAttestationType(value: unknown): value is AttestationType {
  return typeof value === 'string' && ATTESTATION_TYPES.includes(value as AttestationType);
}

export interface RecordAttestationRequestBody {
  commitmentId: string;
  attestationType: AttestationType;
  data: Record<string, unknown>;
  verifiedBy: string;
}

function ensureObject(value: unknown, field: string): Record<string, unknown> {
  if (value === null || value === undefined) {
    throw new ValidationError(`Missing required field: ${field}.`, { field });
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`Field "${field}" must be an object.`, { field });
  }
  return value as Record<string, unknown>;
}

function ensureNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`Field "${field}" must be a non-empty string.`, {
      field,
    });
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
      { field: 'attestationType', allowed: ATTESTATION_TYPES }
    );
  }
  const data = ensureObject(body.data, 'data');
  const verifiedBy = ensureNonEmptyString(body.verifiedBy, 'verifiedBy');

  if (attestationType === 'health_check') {
    const score = data.complianceScore;
    if (score === undefined || score === null) {
      throw new ValidationError(
        'data.complianceScore is required for attestationType "health_check".',
        { field: 'data.complianceScore' }
      );
    }
    const num = Number(score);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      throw new ValidationError(
        'data.complianceScore must be a number between 0 and 100.',
        { field: 'data.complianceScore' }
      );
    }
  }

  if (attestationType === 'fee_generation') {
    const feeEarned = data.feeEarned ?? data.amount;
    if (feeEarned === undefined || feeEarned === null) {
      throw new ValidationError(
        'data.feeEarned or data.amount is required for attestationType "fee_generation".',
        { field: 'data' }
      );
    }
  }

  return {
    commitmentId,
    attestationType,
    data,
    verifiedBy,
  };
}

function mapToRecordParams(
  body: RecordAttestationRequestBody
): RecordAttestationOnChainParams {
  const { commitmentId, attestationType, data, verifiedBy } = body;
  const timestamp = new Date().toISOString();
import { logAttestation } from '@/lib/backend/logger';
import { validatePagination, validateFilters, validateAddress, handleValidationError, createAttestationSchema } from '@/lib/backend/validation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');
    const commitmentId = searchParams.get('commitmentId');
    const attester = searchParams.get('attester');

    // Validate pagination
    const pagination = validatePagination(page, limit);

    return ok({ attestations }, 200);
});

  let complianceScore = 0;
  let violation = false;
  let feeEarned: string | undefined;

  if (attestationType === 'health_check') {
    complianceScore = Number(data.complianceScore);
    violation = Boolean(data.violation);
  } else if (attestationType === 'violation') {
    violation = true;
    complianceScore =
      typeof data.complianceScore === 'number' && Number.isFinite(data.complianceScore)
        ? data.complianceScore
        : 0;
  } else if (attestationType === 'fee_generation') {
    const raw = data.feeEarned ?? data.amount;
    feeEarned =
      typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '0';
    complianceScore =
      typeof data.complianceScore === 'number' && Number.isFinite(data.complianceScore)
        ? data.complianceScore
        : 0;
  } else {
    complianceScore =
      typeof data.complianceScore === 'number' && Number.isFinite(data.complianceScore)
        ? data.complianceScore
        : 0;
    violation = Boolean(data.violation);
    const rawFee = data.feeEarned ?? data.amount;
    if (rawFee !== undefined && rawFee !== null) {
      feeEarned =
        typeof rawFee === 'string' ? rawFee : typeof rawFee === 'number' ? String(rawFee) : undefined;
    }
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
    try {
        const body = (await req.json()) as Record<string, unknown>;
        logAttestation({ ip, ...body });
    } catch {
        logAttestation({ ip, error: 'failed to parse request body' });
    }

    // TODO(issue-126): Enforce validateSession(req) per docs/backend-session-csrf.md before mutating state.
    // TODO(issue-126): Enforce CSRF validation for browser cookie-auth requests (token + origin checks).
    // TODO: verify on-chain data, store attestation in database, etc.

export const GET = withApiHandler(async (req: NextRequest) => {
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

  const isAllowed = await checkRateLimit(ip, 'api/attestations');
  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const { attestations } = await getMockData();

  return ok({ attestations }, 200);
});

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

  try {
    await getCommitmentFromChain(body.commitmentId);
  } catch (err) {
    const normalized = normalizeBackendError(err, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Invalid commitment or unable to fetch commitment from chain.',
      status: 502,
      details: { commitmentId: body.commitmentId },
    });
    return NextResponse.json(toBackendErrorResponse(normalized), {
      status: normalized.status,
    });
  }

  const params = mapToRecordParams(body);

  try {
    const result = await recordAttestationOnChain(params);

    const summary = {
      attestationId: result.attestationId,
      commitmentId: result.commitmentId,
      complianceScore: result.complianceScore,
      violation: result.violation,
      feeEarned: result.feeEarned,
      recordedAt: result.recordedAt,
    };

    return ok(
      {
        attestation: summary,
        txReference: result.txHash ?? null,
      },
      201
    );
  } catch (err) {
    const normalized = normalizeBackendError(err, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Failed to record attestation on chain.',
      status: 502,
      details: { commitmentId: body.commitmentId, attestationType: body.attestationType },
    });
    return NextResponse.json(toBackendErrorResponse(normalized), {
      status: normalized.status,
    });
  }
});
    // Validate filters
    const filters = validateFilters({ commitmentId, attester });

    // Validate addresses if provided
    if (filters.attester) {
      validateAddress(filters.attester as string);
    }

    // Mock response
    const attestations = [
      { id: '1', commitmentId: '123', attester: 'GABC...', rating: 5, comment: 'Great commitment!' },
      // ... more
    ];

    return Response.json({
      attestations,
      pagination,
      filters,
      total: attestations.length
    });
  } catch (error) {
    return handleValidationError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = createAttestationSchema.parse(body);

    // Mock creation
    const newAttestation = {
      id: Date.now().toString(),
      commitmentId: validatedData.commitmentId,
      attester: validatedData.attesterAddress,
      rating: validatedData.rating,
      comment: validatedData.comment || '',
      createdAt: new Date().toISOString()
    };

    return Response.json(newAttestation, { status: 201 });
  } catch (error) {
    return handleValidationError(error);
  }
}
