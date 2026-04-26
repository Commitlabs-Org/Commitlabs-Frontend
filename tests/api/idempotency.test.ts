
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/commitments/route';
import { createMockRequest, parseResponse } from './helpers';
import * as contractService from '@/lib/backend/services/contracts';

// Mock the contract service
vi.mock('@/lib/backend/services/contracts', async () => {
  const actual = await vi.importActual<typeof contractService>('@/lib/backend/services/contracts');
  return {
    ...actual,
    createCommitmentOnChain: vi.fn(),
  };
});

// Mock rate limit to always allow
vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

describe('Idempotency Support for POST /api/commitments', () => {
  const validBody = {
    ownerAddress: 'GBX6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6',
    asset: 'USDC',
    amount: '1000',
    durationDays: 30,
    maxLossBps: 500,
  };

  const mockResult = {
    commitmentId: '123',
    commitment: {
      id: '123',
      ownerAddress: 'GBX6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6',
      asset: 'USDC',
      amount: '1000',
      status: 'ACTIVE',
      complianceScore: 100,
      currentValue: '1000',
      feeEarned: '0',
      violationCount: 0,
    },
    txHash: 'tx_hash_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (contractService.createCommitmentOnChain as any).mockResolvedValue(mockResult);
  });

  it('should create commitment and cache response when Idempotency-Key is provided', async () => {
    const idempotencyKey = 'test-key-1';
    const request1 = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: validBody,
      headers: { 'idempotency-key': idempotencyKey },
    });

    const response1 = await POST(request1);
    const result1 = await parseResponse(response1);

    expect(result1.status).toBe(201);
    expect(contractService.createCommitmentOnChain).toHaveBeenCalledTimes(1);

    // Second request with same key
    const request2 = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: validBody,
      headers: { 'idempotency-key': idempotencyKey },
    });

    const response2 = await POST(request2);
    const result2 = await parseResponse(response2);

    expect(result2.status).toBe(201);
    expect(result2.data).toEqual(result1.data);
    // Should NOT have called the contract service again
    expect(contractService.createCommitmentOnChain).toHaveBeenCalledTimes(1);
  });

  it('should return 409 Conflict if a request with same key is already in progress', async () => {
    const idempotencyKey = 'test-key-2';
    
    // We'll simulate a slow request by making the mock wait
    let resolveRequest: any;
    const slowPromise = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    (contractService.createCommitmentOnChain as any).mockReturnValue(slowPromise);

    const request1 = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: validBody,
      headers: { 'idempotency-key': idempotencyKey },
    });

    // Start the first request (don't await it yet)
    const promise1 = POST(request1);

    // Second request with same key while first is still running
    const request2 = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: validBody,
      headers: { 'idempotency-key': idempotencyKey },
    });

    const response2 = await POST(request2);
    const result2 = await parseResponse(response2);

    expect(result2.status).toBe(409);
    expect(result2.data.error.code).toBe('CONFLICT');

    // Clean up: resolve first request
    resolveRequest(mockResult);
    await promise1;
  });

  it('should allow retrying if the first request failed', async () => {
    const idempotencyKey = 'test-key-3';
    
    // First request fails
    (contractService.createCommitmentOnChain as any).mockRejectedValueOnce(new Error('Chain error'));

    const request1 = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: validBody,
      headers: { 'idempotency-key': idempotencyKey },
    });

    const response1 = await POST(request1);
    const result1 = await parseResponse(response1);
    expect(result1.status).toBe(502); // BLOCKCHAIN_CALL_FAILED usually maps to 502

    // Second request with same key should try again
    (contractService.createCommitmentOnChain as any).mockResolvedValue(mockResult);

    const request2 = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: validBody,
      headers: { 'idempotency-key': idempotencyKey },
    });

    const response2 = await POST(request2);
    const result2 = await parseResponse(response2);

    expect(result2.status).toBe(201);
    expect(contractService.createCommitmentOnChain).toHaveBeenCalledTimes(2);
  });
});
