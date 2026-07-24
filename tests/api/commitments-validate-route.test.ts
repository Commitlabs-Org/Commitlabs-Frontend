import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { parseResponse, createMockRouteContext } from './helpers';

// Mock validation module to avoid importing heavy schemas at test-time.
vi.mock('@/lib/backend/validation', () => ({
  validateCommitmentDraft: vi.fn(() => ({ valid: true, warnings: [], data: {} })),
}));

import { POST } from '@/app/api/commitments/validate/route';

function makeMalformedRequest() {
  return new NextRequest('http://localhost:3000/api/commitments/validate', {
    method: 'POST',
    headers: new Headers({ 'content-type': 'application/json' }),
    body: '}{',
  });
}

describe('POST /api/commitments/validate', () => {
  it('returns 400 when request body is malformed JSON', async () => {
    const req = makeMalformedRequest();
    const res = await POST(req, createMockRouteContext(), 'corr-validate-malformed');
    const { status, data } = await parseResponse(res);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toMatch(/Invalid JSON/i);
  });
});
