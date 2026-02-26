// src/app/api/commitments/route.ts
import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError } from '@/lib/backend/errors';
import { getMockData } from '@/lib/backend/mockDb';
import { logInfo } from '@/lib/backend/logger';
import { validatePagination, validateFilters, validateAddress, handleValidationError, ValidationError, createCommitmentSchema } from '@/lib/backend/validation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');
    const status = searchParams.get('status');
    const creator = searchParams.get('creator');

    // Validate pagination
    const pagination = validatePagination(page, limit);

    const isAllowed = await checkRateLimit(ip, 'api/commitments');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    const { commitments } = await getMockData();

    return ok({ commitments }, 200);
});
export const POST = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/commitments');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    logInfo(req, 'Creating commitment', { ip });

    // TODO(issue-126): Enforce validateSession(req) per docs/backend-session-csrf.md before mutating state.
    // TODO(issue-126): Enforce CSRF validation for browser cookie-auth requests (token + origin checks).
    // TODO: validate request body, interact with Soroban smart contract,
    //       store commitment record in database, mint NFT, etc.

    return ok({ message: 'Commitment created successfully.' }, 201);
});
    // Validate filters
    const filters = validateFilters({ status, creator });

    // If creator is provided, validate it as address
    if (filters.creator) {
      validateAddress(filters.creator as string);
    }

    // Mock response - in real app, fetch from database
    const commitments = [
      { id: '1', title: 'Sample Commitment', creator: 'GABC...', amount: 100 },
      // ... more
    ];

    return Response.json({
      commitments,
      pagination,
      filters,
      total: commitments.length
    });
  } catch (error) {
    return handleValidationError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = createCommitmentSchema.parse(body);

    // Mock creation - in real app, save to database
    const newCommitment = {
      id: Date.now().toString(),
      title: validatedData.title,
      description: validatedData.description,
      amount: validatedData.amount,
      creator: validatedData.creatorAddress,
      createdAt: new Date().toISOString()
    };

    return Response.json(newCommitment, { status: 201 });
  } catch (error) {
    return handleValidationError(error);
  }
}
