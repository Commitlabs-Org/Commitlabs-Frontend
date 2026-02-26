// src/app/api/attestations/route.ts
import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getMockData } from '@/lib/backend/mockDb';
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

export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/attestations');
    if (!isAllowed) {
        throw new TooManyRequestsError();
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

    return ok({ message: 'Attestation recorded successfully.' }, 201);
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
