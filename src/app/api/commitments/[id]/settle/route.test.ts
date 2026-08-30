import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies BEFORE importing the route
vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn(() => 60),
}));

vi.mock('@/lib/backend/logger', () => ({
  logCommitmentSettled: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/backend/idempotency', () => ({
  idempotencyService: {
    getRecord: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
  },
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
  settleCommitmentOnChain: vi.fn(),
}));

// NOW import the route and dependencies
import { POST as postHandler } from './route';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { idempotencyService } from '@/lib/backend/idempotency';
import { CsrfValidationError } from '@/lib/backend/errors';
import type { ChainCommitment, ChainCommitmentStatus } from '@/lib/backend/services/contracts';
import { getCommitmentFromChain, settleCommitmentOnChain } from '@/lib/backend/services/contracts';

const mockedAssertMutationCsrf = vi.mocked(assertMutationCsrf);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedIdempotency = vi.mocked(idempotencyService);
const mockedGetCommitmentFromChain = vi.mocked(getCommitmentFromChain);
const mockedSettleCommitmentOnChain = vi.mocked(settleCommitmentOnChain);

const POST = postHandler as (
  req: NextRequest,
  context: { params: Record<string, string> },
) => Promise<Response>;

const VALID_ADDRESS = `G${'A'.repeat(55)}`;
const DIFFERENT_ADDRESS = `G${'B'.repeat(55)}`;
const COMMITMENT_ID = 'cm_123456';
const BASE_URL = `http://localhost:3000/api/commitments/${COMMITMENT_ID}/settle`;

function makeRequest(options: { body?: unknown; idempotencyKey?: string } = {}) {
  const { body = { callerAddress: VALID_ADDRESS }, idempotencyKey } = options;
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const requestInit: { method: string; headers: Headers; body?: string } = {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json', ...headers }),
  };
  const bodyInit = body ? JSON.stringify(body) : undefined;
  if (bodyInit !== undefined) requestInit.body = bodyInit;
  return new NextRequest(BASE_URL, requestInit);
}

const ctx = { params: { id: COMMITMENT_ID } };

function activeCommitment(overrides: Partial<ChainCommitment> = {}): ChainCommitment {
  return {
    id: COMMITMENT_ID,
    ownerAddress: VALID_ADDRESS,
    asset: 'USDC',
    amount: '1000',
    status: 'ACTIVE',
    complianceScore: 80,
    currentValue: '1000',
    feeEarned: '0',
    violationCount: 0,
    ...overrides,
  };
}

function settlementResult(overrides: Record<string, unknown> = {}) {
  return {
    settlementAmount: '1000',
    finalStatus: 'SETTLED',
    txHash: 'tx_abc',
    reference: 'ref_1',
    ...overrides,
  };
}

describe('POST /api/commitments/[id]/settle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAssertMutationCsrf.mockReset();
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedGetCommitmentFromChain.mockResolvedValue(activeCommitment());
    mockedSettleCommitmentOnChain.mockResolvedValue(settlementResult());
    mockedIdempotency.getRecord.mockResolvedValue(null);
    mockedIdempotency.start.mockResolvedValue(true);
    mockedIdempotency.complete.mockResolvedValue(undefined as never);
    mockedIdempotency.fail.mockResolvedValue(undefined as never);
  });

  it('returns 200 and settles a commitment on success', async () => {
    const response = await POST(makeRequest(), ctx);
    const result = await parse(response);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.finalStatus).toBe('SETTLED');
    expect(result.data.data.commitmentId).toBe(COMMITMENT_ID);
    expect(mockedSettleCommitmentOnChain).toHaveBeenCalledWith(
      { commitmentId: COMMITMENT_ID, callerAddress: VALID_ADDRESS },
      expect.objectContaining({ requestId: expect.any(String) }),
    );
  });

  it('returns 400 when the commitment id is missing', async () => {
    const response = await POST(makeRequest(), { params: { id: '  ' } });
    const result = await parse(response);
    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
    expect(mockedSettleCommitmentOnChain).not.toHaveBeenCalled();
  });

  it('returns 404 when the commitment does not exist', async () => {
    mockedGetCommitmentFromChain.mockResolvedValue(null as never);
    const response = await POST(makeRequest(), ctx);
    const result = await parse(response);
    expect(result.status).toBe(404);
    expect(result.data.error.code).toBe('NOT_FOUND');
  });

  it.each<[ChainCommitmentStatus, string]>([
    ['SETTLED', 'already been settled'],
    ['VIOLATED', 'been violated'],
    ['EARLY_EXIT', 'been exited early'],
  ])('rejects settling a %s commitment with 409', async (status, fragment) => {
    mockedGetCommitmentFromChain.mockResolvedValue(activeCommitment({ status }));
    const response = await POST(makeRequest(), ctx);
    const result = await parse(response);

    expect(result.status).toBe(409);
    expect(result.data.error.code).toBe('CONFLICT');
    expect(result.data.error.message).toContain(fragment);
    expect(mockedSettleCommitmentOnChain).not.toHaveBeenCalled();
  });

  it('returns 403 when callerAddress does not own the commitment', async () => {
    const response = await POST(makeRequest({ body: { callerAddress: DIFFERENT_ADDRESS } }), ctx);
    const result = await parse(response);

    expect(result.status).toBe(403);
    expect(result.data.error.code).toBe('FORBIDDEN');
    expect(mockedSettleCommitmentOnChain).not.toHaveBeenCalled();
  });

  it('returns 403 when the CSRF token is invalid', async () => {
    mockedAssertMutationCsrf.mockImplementation(() => {
      throw new CsrfValidationError('Missing CSRF token.', { reason: 'missing_header' });
    });
    const response = await POST(makeRequest(), ctx);
    const result = await parse(response);

    expect(result.status).toBe(403);
    expect(result.data.error.code).toBe('CSRF_INVALID');
    expect(mockedSettleCommitmentOnChain).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited without settling', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);
    const response = await POST(makeRequest(), ctx);
    const result = await parse(response);

    expect(result.status).toBe(429);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
    expect(mockedSettleCommitmentOnChain).not.toHaveBeenCalled();
  });

  // ─── Idempotency / transactional recovery (issue #1765) ───────────────────

  it('replays a COMPLETED idempotency key without re-settling on chain', async () => {
    mockedIdempotency.getRecord.mockResolvedValue({
      key: 'k1',
      status: 'COMPLETED',
      response: settlementResult({ txHash: 'original_tx' }),
      statusCode: 200,
      createdAt: 1,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });

    const response = await POST(makeRequest({ idempotencyKey: 'k1' }), ctx);
    const result = await parse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.txHash).toBe('original_tx');
    expect(mockedSettleCommitmentOnChain).not.toHaveBeenCalled();
    expect(mockedIdempotency.complete).not.toHaveBeenCalled();
  });

  it('returns 409 when the idempotency record is STARTED (in flight)', async () => {
    mockedIdempotency.getRecord.mockResolvedValue({
      key: 'k1',
      status: 'STARTED',
      createdAt: 1,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });

    const response = await POST(makeRequest({ idempotencyKey: 'k1' }), ctx);
    const result = await parse(response);

    expect(result.status).toBe(409);
    expect(result.data.error.code).toBe('CONFLICT');
    expect(mockedSettleCommitmentOnChain).not.toHaveBeenCalled();
  });

  it('returns 409 and does NOT settle when a concurrent request won the start race', async () => {
    // Simulate the TOCTOU window: our getRecord read saw nothing, but start()
    // reports a concurrent request already claimed the key.
    mockedIdempotency.getRecord.mockResolvedValue(null);
    mockedIdempotency.start.mockResolvedValue(false);

    const response = await POST(makeRequest({ idempotencyKey: 'k1' }), ctx);
    const result = await parse(response);

    expect(result.status).toBe(409);
    expect(mockedSettleCommitmentOnChain).not.toHaveBeenCalled();
    expect(mockedIdempotency.complete).not.toHaveBeenCalled();
  });

  it('marks the key COMPLETED with the settlement payload on success', async () => {
    await POST(makeRequest({ idempotencyKey: 'k1' }), ctx);

    expect(mockedIdempotency.complete).toHaveBeenCalledWith(
      'k1',
      expect.objectContaining({ txHash: 'tx_abc' }),
      200,
    );
  });

  it('releases the key on failure so the client can safely retry', async () => {
    mockedSettleCommitmentOnChain.mockRejectedValue(new Error('chain unavailable'));

    const response = await POST(makeRequest({ idempotencyKey: 'k1' }), ctx);
    const result = await parse(response);

    expect(result.status).toBe(500);
    expect(mockedIdempotency.fail).toHaveBeenCalledWith('k1');
  });

  it('allows a successful retry after a failure (recovery honoring intent, no silent repeat)', async () => {
    mockedSettleCommitmentOnChain
      .mockRejectedValueOnce(new Error('chain unavailable'))
      .mockResolvedValueOnce(settlementResult());

    // First attempt fails and the key is released.
    const first = await parse(await POST(makeRequest({ idempotencyKey: 'k1' }), ctx));
    expect(first.status).toBe(500);
    expect(mockedIdempotency.fail).toHaveBeenCalledWith('k1');

    // Retry with the same key succeeds and settles exactly once more.
    const second = await parse(await POST(makeRequest({ idempotencyKey: 'k1' }), ctx));
    expect(second.status).toBe(200);
    expect(mockedIdempotency.complete).toHaveBeenCalledWith('k1', expect.anything(), 200);
    // Exactly two on-chain attempts total: the failed one never broadcast, and
    // the successful one settled once. The user's settle intent is preserved
    // without the settlement action being silently duplicated.
    expect(mockedSettleCommitmentOnChain).toHaveBeenCalledTimes(2);
  });
});

async function parse(response: Response) {
  return {
    status: response.status,
    data: await response.json(),
    headers: response.headers,
  };
}
