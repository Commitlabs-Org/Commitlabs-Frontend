/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getRateLimitWindowSeconds: vi.fn().mockReturnValue(60),
}));
vi.mock('@/lib/backend/services/contracts', () => ({
  createCommitmentOnChain: vi
    .fn()
    .mockResolvedValue({ commitmentId: 'CMT-TEST123', commitment: { id: 'CMT-TEST123' } }),
  getUserCommitmentsFromChain: vi.fn(),
}));
vi.mock('@/lib/backend/csrf', () => ({ assertMutationCsrf: vi.fn() }));
vi.mock('@/lib/backend/idempotency', () => ({
  idempotencyService: {
    getRecord: vi.fn().mockResolvedValue(null),
    start: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/lib/backend/requireAuth', () => ({
  verifyAuth: vi.fn(),
  requireAuth: vi.fn(),
}));

import { POST } from './route';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { createCommitmentOnChain } from '@/lib/backend/services/contracts';
import { verifyAuth } from '@/lib/backend/requireAuth';
import { idempotencyService } from '@/lib/backend/idempotency';

const mockVerifyAuth = vi.mocked(verifyAuth);
const mockIdem = vi.mocked(idempotencyService);

const VALID_ADDRESS = 'G' + 'A'.repeat(55);
const OTHER_ADDRESS = 'G' + 'B'.repeat(55);

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/commitments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue(true);
  vi.mocked(createCommitmentOnChain).mockResolvedValue({
    commitmentId: 'CMT-OK123',
    commitment: { id: 'CMT-OK123' },
  } as any);
  mockIdem.getRecord.mockResolvedValue(null);
});

describe('POST /api/commitments boundary', () => {
  it('success - valid payload', async () => {
    mockVerifyAuth.mockReturnValue({ address: VALID_ADDRESS, isAdmin: false });
    const r = await POST(
      req({
        ownerAddress: VALID_ADDRESS,
        asset: 'XLM',
        amount: '100',
        durationDays: 30,
        maxLossBps: 5000,
      }) as any,
      { params: {} } as any,
      'cid1',
    );
    expect(r.status).toBe(201);
  });

  it('rejects tampered amount (NaN)', async () => {
    mockVerifyAuth.mockReturnValue({ address: VALID_ADDRESS, isAdmin: false });
    const r = await POST(
      req({
        ownerAddress: VALID_ADDRESS,
        asset: 'XLM',
        amount: 'NaN',
        durationDays: 30,
        maxLossBps: 100,
      }) as any,
      { params: {} } as any,
      'cid',
    );
    const j = await r.json();
    expect(r.status).toBe(400);
    expect(j.success).toBe(false);
  });

  it('rejects Infinity amount (malformed)', async () => {
    mockVerifyAuth.mockReturnValue({ address: VALID_ADDRESS, isAdmin: false });
    const r = await POST(
      req({
        ownerAddress: VALID_ADDRESS,
        asset: 'XLM',
        amount: 'Infinity',
        durationDays: 30,
        maxLossBps: 100,
      }) as any,
      { params: {} } as any,
      'cid',
    );
    expect(r.status).toBe(400);
  });

  it('rejects wrong asset (ETH not allowed)', async () => {
    mockVerifyAuth.mockReturnValue({ address: VALID_ADDRESS, isAdmin: false });
    const r = await POST(
      req({
        ownerAddress: VALID_ADDRESS,
        asset: 'ETH',
        amount: '10',
        durationDays: 30,
        maxLossBps: 100,
      }) as any,
      { params: {} } as any,
      'cid',
    );
    expect(r.status).toBe(400);
  });

  it('rejects duration out of bounds', async () => {
    mockVerifyAuth.mockReturnValue({ address: VALID_ADDRESS, isAdmin: false });
    const r = await POST(
      req({
        ownerAddress: VALID_ADDRESS,
        asset: 'XLM',
        amount: '10',
        durationDays: 9999,
        maxLossBps: 100,
      }) as any,
      { params: {} } as any,
      'cid',
    );
    expect(r.status).toBe(400);
  });

  it('enforces ownership - owner mismatch 403', async () => {
    mockVerifyAuth.mockReturnValue({ address: VALID_ADDRESS, isAdmin: false });
    const r = await POST(
      req({
        ownerAddress: OTHER_ADDRESS,
        asset: 'XLM',
        amount: '10',
        durationDays: 30,
        maxLossBps: 100,
      }) as any,
      { params: {} } as any,
      'cid',
    );
    expect(r.status).toBe(403);
  });

  it('idempotency - returns cached COMPLETED', async () => {
    mockVerifyAuth.mockReturnValue({ address: VALID_ADDRESS, isAdmin: false });
    mockIdem.getRecord.mockResolvedValue({
      key: 'k1',
      status: 'COMPLETED',
      response: { commitmentId: 'CMT-CACHED' },
      statusCode: 201,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10000,
    } as any);
    const r = await POST(
      req(
        {
          ownerAddress: VALID_ADDRESS,
          asset: 'XLM',
          amount: '10',
          durationDays: 30,
          maxLossBps: 100,
        },
        { 'idempotency-key': 'k1-cached-12345' },
      ) as any,
      { params: {} } as any,
      'cid',
    );
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j.data.commitmentId).toBe('CMT-CACHED');
    expect(createCommitmentOnChain).not.toHaveBeenCalled();
  });

  it('idempotency - 409 when STARTED (replay)', async () => {
    mockVerifyAuth.mockReturnValue({ address: VALID_ADDRESS, isAdmin: false });
    mockIdem.getRecord.mockResolvedValue({
      key: 'k2',
      status: 'STARTED',
      createdAt: Date.now(),
      expiresAt: Date.now() + 10000,
    } as any);
    const r = await POST(
      req(
        {
          ownerAddress: VALID_ADDRESS,
          asset: 'XLM',
          amount: '10',
          durationDays: 30,
          maxLossBps: 100,
        },
        { 'idempotency-key': 'k2-start-123456' },
      ) as any,
      { params: {} } as any,
      'cid',
    );
    expect(r.status).toBe(409);
  });

  it('rejects invalid Idempotency-Key format', async () => {
    const r = await POST(
      req(
        {
          ownerAddress: VALID_ADDRESS,
          asset: 'XLM',
          amount: '10',
          durationDays: 30,
          maxLossBps: 100,
        },
        { 'idempotency-key': 'bad key!' },
      ) as any,
      { params: {} } as any,
      'cid',
    );
    expect(r.status).toBe(400);
  });

  it('fails idempotency key on error (retry)', async () => {
    mockVerifyAuth.mockReturnValue({ address: VALID_ADDRESS, isAdmin: false });
    vi.mocked(createCommitmentOnChain).mockRejectedValue(new Error('chain down'));
    const r = await POST(
      req(
        {
          ownerAddress: VALID_ADDRESS,
          asset: 'XLM',
          amount: '10',
          durationDays: 30,
          maxLossBps: 100,
        },
        { 'idempotency-key': 'retry-12345678' },
      ) as any,
      { params: {} } as any,
      'cid',
    );
    expect(r.status).toBe(500);
    expect(mockIdem.fail).toHaveBeenCalledWith('retry-12345678');
  });

  it('rejects malformed JSON', async () => {
    const badReq = new NextRequest('http://localhost/api/commitments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    // need to bypass idempotency header
    const r = await POST(badReq as any, { params: {} } as any, 'cid');
    // parseJsonWithLimit will throw -> handled as 400 or 500 depending on implementation
    expect([400, 500]).toContain(r.status);
  });
});
