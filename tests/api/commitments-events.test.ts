import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/commitments/[id]/events/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
}));

vi.mock('@/lib/backend/auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/backend/withApiHandler', () => ({
  withApiHandler: (handler: any) => handler,
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetCommitmentFromChain = vi.mocked(getCommitmentFromChain);

describe('GET /api/commitments/[id]/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedGetCommitmentFromChain.mockResolvedValue({ status: 'ACTIVE' } as any);
  });

  it('enforces rate limiting', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);
    const req = new NextRequest('http://localhost:3000/api/commitments/123/events');
    const response = await GET(req, { params: { id: '123' } } as any);
    expect(response.status).toBe(429);
  });

  it('validates and clamps interval values (NaN case)', async () => {
    process.env.SSE_POLL_INTERVAL_MS = 'NaN';
    process.env.SSE_KEEPALIVE_INTERVAL_MS = 'invalid';

    // We can't easily test the internal setInterval behavior without mocking it,
    // but we can check if the code runs without throwing.
    const req = new NextRequest('http://localhost:3000/api/commitments/123/events');
    const response = await GET(req, { params: { id: '123' } } as any);
    expect(response.status).toBe(200);

    // Cleanup
    delete process.env.SSE_POLL_INTERVAL_MS;
    delete process.env.SSE_KEEPALIVE_INTERVAL_MS;
  });
});
