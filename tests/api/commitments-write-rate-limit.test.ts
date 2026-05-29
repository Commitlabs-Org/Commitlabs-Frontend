/**
 * Rate limiting tests for write-heavy commitment routes:
 *   POST /api/commitments          (create)
 *   POST /api/commitments/[id]/settle
 *   POST /api/commitments/[id]/early-exit
 *
 * Verifies that:
 *   - 429 is returned when checkRateLimit returns false
 *   - The Retry-After header is present and numeric
 *   - The error body uses the TOO_MANY_REQUESTS code
 *   - The rate limiter is keyed by the correct routeId
 *   - Requests pass through when the limiter allows them
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers';

// ── shared mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn().mockReturnValue(60),
}));

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}));

vi.mock('@/lib/backend/logger', () => ({
  logEarlyExit: vi.fn(),
  logCommitmentSettled: vi.fn(),
  logCommitmentCreated: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn(),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn().mockResolvedValue([]),
  createCommitmentOnChain: vi.fn(),
  getCommitmentFromChain: vi.fn(),
  settleCommitmentOnChain: vi.fn(),
  earlyExitCommitmentOnChain: vi.fn(),
}));

vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));

vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { requireAuth } from '@/lib/backend/requireAuth';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedRequireAuth = vi.mocked(requireAuth);
const VALID_ADDRESS = `G${'A'.repeat(55)}`;

// ── helpers ───────────────────────────────────────────────────────────────────

function postRequest(url: string, body?: unknown) {
  return createMockRequest(url, { method: 'POST', body });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/commitments  (create)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/commitments — rate limiting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 429 with Retry-After when rate limit is exceeded', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const { POST } = await import('@/app/api/commitments/route');
    const req = postRequest('http://localhost:3000/api/commitments', {
      ownerAddress: 'GABC',
      asset: 'USDC',
      amount: '100',
      durationDays: 30,
      maxLossBps: 500,
    });

    const response = await POST(req, createMockRouteContext());
    const result = await parseResponse(response);

    expect(result.status).toBe(429);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
    expect(result.headers.get('retry-after')).not.toBeNull();
    expect(Number(result.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('uses the api/commitments/create route key', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const { POST } = await import('@/app/api/commitments/route');
    const req = postRequest('http://localhost:3000/api/commitments', {});

    await POST(req, createMockRouteContext());

    expect(mockedCheckRateLimit).toHaveBeenCalledWith('1.2.3.4', 'api/commitments/create');
  });

  it('allows the request through when rate limit is not exceeded', async () => {
    const { createCommitmentOnChain } = await import('@/lib/backend/services/contracts');
    vi.mocked(createCommitmentOnChain).mockResolvedValue({ commitmentId: 'c-1' } as any);
    mockedCheckRateLimit.mockResolvedValue(true);

    const { POST } = await import('@/app/api/commitments/route');
    const req = postRequest('http://localhost:3000/api/commitments', {
      ownerAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      asset: 'USDC',
      amount: '100',
      durationDays: 30,
      maxLossBps: 500,
    });

    const response = await POST(req, createMockRouteContext());
    expect(response.status).not.toBe(429);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/commitments/[id]/settle
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/commitments/[id]/settle — rate limiting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 429 with Retry-After when rate limit is exceeded', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const { POST } = await import('@/app/api/commitments/[id]/settle/route');
    const req = postRequest('http://localhost:3000/api/commitments/abc/settle', {});
    const ctx = createMockRouteContext({ id: 'abc' });

    const response = await POST(req, ctx);
    const result = await parseResponse(response);

    expect(result.status).toBe(429);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
    expect(result.headers.get('retry-after')).not.toBeNull();
    expect(Number(result.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('uses the api/commitments/settle route key', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const { POST } = await import('@/app/api/commitments/[id]/settle/route');
    const req = postRequest('http://localhost:3000/api/commitments/abc/settle', {});

    await POST(req, createMockRouteContext({ id: 'abc' }));

    expect(mockedCheckRateLimit).toHaveBeenCalledWith('1.2.3.4', 'api/commitments/settle');
  });

  it('allows the request through when rate limit is not exceeded', async () => {
    const { getCommitmentFromChain, settleCommitmentOnChain } = await import('@/lib/backend/services/contracts');
    vi.mocked(getCommitmentFromChain).mockResolvedValue({ status: 'ACTIVE' } as any);
    vi.mocked(settleCommitmentOnChain).mockResolvedValue({
      settlementAmount: '100',
      finalStatus: 'SETTLED',
      txHash: 'tx-1',
      reference: 'ref-1',
    } as any);
    mockedCheckRateLimit.mockResolvedValue(true);

    const { POST } = await import('@/app/api/commitments/[id]/settle/route');
    const req = postRequest('http://localhost:3000/api/commitments/abc/settle', {});
    const response = await POST(req, createMockRouteContext({ id: 'abc' }));

    expect(response.status).not.toBe(429);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/commitments/[id]/early-exit
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/commitments/[id]/early-exit — rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAuth.mockReturnValue({
      user: { address: VALID_ADDRESS, csrfToken: 'csrf-token' },
    } as any);
  });

  it('returns 429 with Retry-After when rate limit is exceeded', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const { POST } = await import('@/app/api/commitments/[id]/early-exit/route');
    const req = postRequest('http://localhost:3000/api/commitments/abc/early-exit', {});
    const ctx = createMockRouteContext({ id: 'abc' });

    const response = await POST(req, ctx);
    const result = await parseResponse(response);

    expect(result.status).toBe(429);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
    expect(result.headers.get('retry-after')).not.toBeNull();
    expect(Number(result.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('uses the api/commitments/early-exit route key', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const { POST } = await import('@/app/api/commitments/[id]/early-exit/route');
    const req = postRequest('http://localhost:3000/api/commitments/abc/early-exit', {});

    await POST(req, createMockRouteContext({ id: 'abc' }));

    expect(mockedCheckRateLimit).toHaveBeenCalledWith('1.2.3.4', 'api/commitments/early-exit');
  });

  it('allows the request through when rate limit is not exceeded', async () => {
    const { getCommitmentFromChain, earlyExitCommitmentOnChain } = await import('@/lib/backend/services/contracts');
    vi.mocked(getCommitmentFromChain).mockResolvedValue({
      id: 'abc',
      ownerAddress: VALID_ADDRESS,
      status: 'ACTIVE',
    } as any);
    vi.mocked(earlyExitCommitmentOnChain).mockResolvedValue({
      exitAmount: '95',
      penaltyAmount: '5',
      finalStatus: 'EARLY_EXIT',
      txHash: 'tx-1',
      reference: 'ref-1',
    } as any);
    mockedCheckRateLimit.mockResolvedValue(true);

    const { POST } = await import('@/app/api/commitments/[id]/early-exit/route');
    const req = postRequest('http://localhost:3000/api/commitments/abc/early-exit', {
      reason: 'Need liquidity',
      callerAddress: VALID_ADDRESS,
    });
    const response = await POST(req, createMockRouteContext({ id: 'abc' }));

    expect(response.status).not.toBe(429);
    expect(response.status).toBe(200);
  });
});
