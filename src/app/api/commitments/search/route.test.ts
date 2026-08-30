import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { UnauthorizedError, ForbiddenError } from '@/lib/backend/errors';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));
vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
}));
vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
}));
vi.mock('@/lib/backend/cache/factory', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';
import { requireAuth } from '@/lib/backend/requireAuth';
import { cache } from '@/lib/backend/cache/factory';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockGetUserCommitmentsFromChain = vi.mocked(getUserCommitmentsFromChain);
const mockRequireAuth = vi.mocked(requireAuth);
const mockCacheGet = vi.mocked(cache.get);
const mockCacheSet = vi.mocked(cache.set);

const OWNER_ADDRESS = 'GA7Q3ZBPV3R3L3GGB4G2N7N5O2X65Z62Q6J2X65Z62Q6J2X65Z62Q6J2';
const OTHER_ADDRESS = 'GB7Q3ZBPV3R3L3GGB4G2N7N5O2X65Z62Q6J2X65Z62Q6J2X65Z62Q6J2';

describe('GET /api/commitments/search', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockRequireAuth.mockReturnValue({ user: { address: OWNER_ADDRESS, csrfToken: 'token' } } as any);
    mockCacheGet.mockResolvedValue(null);
    mockGetUserCommitmentsFromChain.mockResolvedValue([
      {
        id: 'cmt-1',
        ownerAddress: OWNER_ADDRESS,
        asset: 'USDC',
        amount: '1000',
        status: 'ACTIVE',
        complianceScore: 95,
        currentValue: '1000',
        feeEarned: '0',
        violationCount: 0,
        createdAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-02-01T00:00:00Z',
      },
    ]);
  });

  it('searches commitments for authorized owner', async () => {
    const req = new NextRequest(`http://localhost/api/commitments/search?ownerAddress=${OWNER_ADDRESS}`);
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.data).toHaveLength(1);
    expect(body.data.data[0].commitmentId).toBe('cmt-1');
  });

  it('rejects when unauthenticated', async () => {
    mockRequireAuth.mockImplementation(() => {
      throw new UnauthorizedError('No session token provided');
    });
    const req = new NextRequest(`http://localhost/api/commitments/search?ownerAddress=${OWNER_ADDRESS}`);
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects when search ownerAddress does not match session address', async () => {
    const req = new NextRequest(`http://localhost/api/commitments/search?ownerAddress=${OTHER_ADDRESS}`);
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid Stellar public key format', async () => {
    const req = new NextRequest(`http://localhost/api/commitments/search?ownerAddress=INVALID_KEY`);
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
