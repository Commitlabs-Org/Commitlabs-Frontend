// src/app/api/attestations/route.ts
import { NextRequest } from 'next/server';
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
