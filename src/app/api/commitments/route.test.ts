import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, OPTIONS } from './route';
import { UnauthorizedError, ForbiddenError, ValidationError } from '@/lib/backend/errors';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn(),
}));
vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
  createCommitmentOnChain: vi.fn(),
}));
vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));
vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
  verifyAuth: vi.fn(),
}));
vi.mock('@/lib/backend/config', () => ({
  getBackendConfig: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getUserCommitmentsFromChain, createCommitmentOnChain } from '@/lib/backend/services/contracts';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { requireAuth, verifyAuth } from '@/lib/backend/requireAuth';
import { getBackendConfig } from '@/lib/backend/config';

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockGetUserCommitmentsFromChain = vi.mocked(getUserCommitmentsFromChain);
const mockCreateCommitmentOnChain = vi.mocked(createCommitmentOnChain);
const mockAssertMutationCsrf = vi.mocked(assertMutationCsrf);
const mockRequireAuth = vi.mocked(requireAuth);
const mockVerifyAuth = vi.mocked(verifyAuth);
const mockGetBackendConfig = vi.mocked(getBackendConfig);

const OWNER_ADDRESS = 'GA7Q3ZBPV3R3L3GGB4G2N7N5O2X65Z62Q6J2X65Z62Q6J2X65Z62Q6J2';
const OTHER_ADDRESS = 'GB7Q3ZBPV3R3L3GGB4G2N7N5O2X65Z62Q6J2X65Z62Q6J2X65Z62Q6J2';
const TEST_NETWORK = 'Test SDF Network ; September 2015';

describe('GET /api/commitments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockRequireAuth.mockReturnValue({ user: { address: OWNER_ADDRESS, csrfToken: 'token' } } as any);
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
        contractVersion: '1.0.0',
      },
    ]);
  });

  it('returns commitments for authorized owner', async () => {
    const req = new NextRequest(`http://localhost/api/commitments?ownerAddress=${OWNER_ADDRESS}`);
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].commitmentId).toBe('cmt-1');
  });

  it('rejects when unauthenticated', async () => {
    mockRequireAuth.mockImplementation(() => {
      throw new UnauthorizedError('No session token provided');
    });
    const req = new NextRequest(`http://localhost/api/commitments?ownerAddress=${OWNER_ADDRESS}`);
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects when requested ownerAddress does not match session address', async () => {
    const req = new NextRequest(`http://localhost/api/commitments?ownerAddress=${OTHER_ADDRESS}`);
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects malformed Stellar address', async () => {
    const req = new NextRequest(`http://localhost/api/commitments?ownerAddress=INVALID_ADDRESS`);
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/commitments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockVerifyAuth.mockReturnValue({ address: OWNER_ADDRESS, isAdmin: false });
    mockGetBackendConfig.mockReturnValue({ networkPassphrase: TEST_NETWORK } as any);
    mockCreateCommitmentOnChain.mockResolvedValue({
      commitmentId: 'cmt-new',
      ownerAddress: OWNER_ADDRESS,
      txHash: '0xhash',
    } as any);
  });

  it('creates commitment on chain with valid input', async () => {
    const req = new NextRequest('http://localhost/api/commitments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: OWNER_ADDRESS,
        asset: 'USDC',
        amount: '500',
        durationDays: 30,
        maxLossBps: 500,
        network: TEST_NETWORK,
      }),
    });

    const res = await POST(req, {});
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.commitmentId).toBe('cmt-new');
  });

  it('rejects when body ownerAddress does not match session address', async () => {
    const req = new NextRequest('http://localhost/api/commitments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: OTHER_ADDRESS,
        asset: 'USDC',
        amount: '500',
        durationDays: 30,
        maxLossBps: 500,
      }),
    });

    const res = await POST(req, {});
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects wrong network passphrase', async () => {
    const req = new NextRequest('http://localhost/api/commitments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: OWNER_ADDRESS,
        asset: 'USDC',
        amount: '500',
        durationDays: 30,
        maxLossBps: 500,
        network: 'Wrong Network Passphrase',
      }),
    });

    const res = await POST(req, {});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects negative or zero amount', async () => {
    const req = new NextRequest('http://localhost/api/commitments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: OWNER_ADDRESS,
        asset: 'USDC',
        amount: '-100',
        durationDays: 30,
        maxLossBps: 500,
      }),
    });

    const res = await POST(req, {});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unsupported asset', async () => {
    const req = new NextRequest('http://localhost/api/commitments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: OWNER_ADDRESS,
        asset: 'UNSUPPORTED_TOKEN',
        amount: '100',
        durationDays: 30,
        maxLossBps: 500,
      }),
    });

    const res = await POST(req, {});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
