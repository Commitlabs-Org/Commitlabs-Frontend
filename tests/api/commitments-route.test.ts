import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';

vi.mock('@/lib/backend/requireAuth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/backend/csrf', () => ({
  assertMutationCsrf: vi.fn(),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitWindowSeconds: vi.fn(() => 60),
}));

vi.mock('@/lib/backend/getClientIp', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
  createCommitmentOnChain: vi.fn(),
}));

vi.mock('@/lib/backend/validation', () => ({
  validateSupportedAsset: vi.fn(),
  validateStellarAddress: vi.fn(),
}));

import { GET, POST } from '@/app/api/commitments/route';
import { requireAuth } from '@/lib/backend/requireAuth';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { assertMutationCsrf } from '@/lib/backend/csrf';
import {
  getUserCommitmentsFromChain,
  createCommitmentOnChain,
} from '@/lib/backend/services/contracts';
import type {
  ChainCommitment,
  CreateCommitmentOnChainResult,
} from '@/lib/backend/services/contracts';
import { validateSupportedAsset, validateStellarAddress } from '@/lib/backend/validation';
import { CsrfValidationError } from '@/lib/backend/errors';
import { UnauthorizedError } from '@/lib/backend/errors';

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAssertMutationCsrf = vi.mocked(assertMutationCsrf);
const mockedGetUserCommitmentsFromChain = vi.mocked(getUserCommitmentsFromChain);
const mockedCreateCommitmentOnChain = vi.mocked(createCommitmentOnChain);
const mockedValidateSupportedAsset = vi.mocked(validateSupportedAsset);
const mockedValidateStellarAddress = vi.mocked(validateStellarAddress);

const VALID_ADDRESS = `G${'A'.repeat(55)}`;
const BASE_URL = 'http://localhost:3000/api/commitments';

const ACTIVE: ChainCommitment = {
  id: 'cm_1',
  ownerAddress: VALID_ADDRESS,
  asset: 'USDC',
  amount: '1000',
  status: 'ACTIVE',
  complianceScore: 85,
  currentValue: '1000',
  feeEarned: '0',
  violationCount: 0,
  createdAt: '2024-01-01T00:00:00Z',
  expiresAt: '2025-01-01T00:00:00Z',
};

const SETTLED: ChainCommitment = {
  id: 'cm_2',
  ownerAddress: VALID_ADDRESS,
  asset: 'XLM',
  amount: '5000',
  status: 'SETTLED',
  complianceScore: 95,
  currentValue: '5000',
  feeEarned: '10',
  violationCount: 0,
  createdAt: '2024-02-01T00:00:00Z',
  expiresAt: '2025-02-01T00:00:00Z',
};

const LOW_COMPLIANCE: ChainCommitment = {
  id: 'cm_3',
  ownerAddress: VALID_ADDRESS,
  asset: 'USDC',
  amount: '200',
  status: 'ACTIVE',
  complianceScore: 45,
  currentValue: '200',
  feeEarned: '5',
  violationCount: 1,
  createdAt: '2024-03-01T00:00:00Z',
  expiresAt: '2025-03-01T00:00:00Z',
};

const ALL_COMMITMENTS = [ACTIVE, SETTLED, LOW_COMPLIANCE];

function getUrl(query: Record<string, string | number>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }
  return `${BASE_URL}?${params.toString()}`;
}

function getUrlWithOwner(query: Record<string, string | number> = {}): string {
  return getUrl({ ownerAddress: VALID_ADDRESS, ...query });
}

describe('GET /api/commitments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAuth.mockImplementation((req) => req as any);
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedGetUserCommitmentsFromChain.mockResolvedValue(ALL_COMMITMENTS);
  });

  it('returns 401 when the caller has no valid session', async () => {
    mockedRequireAuth.mockImplementation(() => {
      throw new UnauthorizedError('No session token provided');
    });

    const response = await GET(createMockRequest(getUrlWithOwner()));
    const result = await parseResponse(response);

    expect(result.status).toBe(401);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('UNAUTHORIZED');
    expect(mockedGetUserCommitmentsFromChain).not.toHaveBeenCalled();
  });

  it('checks authorization before rate limiting or chain reads', async () => {
    mockedRequireAuth.mockImplementation(() => {
      throw new UnauthorizedError('No session token provided');
    });

    await GET(createMockRequest(getUrlWithOwner()));

    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
    expect(mockedGetUserCommitmentsFromChain).not.toHaveBeenCalled();
  });

  it('returns paginated items with success envelope', async () => {
    const response = await GET(createMockRequest(getUrlWithOwner({ page: 1, pageSize: 2 })));
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data.items).toHaveLength(2);
    expect(result.data.data.page).toBe(1);
    expect(result.data.data.pageSize).toBe(2);
    expect(result.data.data.total).toBe(3);
    expect(result.data.meta).toMatchObject({
      correlationId: expect.any(String),
      timestamp: expect.any(String),
    });
  });

  it('maps commitment fields to DTO', async () => {
    const response = await GET(createMockRequest(getUrlWithOwner()));
    const result = await parseResponse(response);
    const item = result.data.data.items[0];

    expect(item).toMatchObject({
      commitmentId: 'cm_1',
      ownerAddress: VALID_ADDRESS,
      asset: 'USDC',
      amount: '1000',
      status: 'ACTIVE',
      complianceScore: 85,
      type: 'Safe',
      currentValue: '1000',
      feeEarned: '0',
      violationCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: '2025-01-01T00:00:00Z',
    });
  });

  it('paginates correctly across pages', async () => {
    const page1 = await parseResponse(
      await GET(createMockRequest(getUrlWithOwner({ page: 1, pageSize: 2 }))),
    );
    expect(page1.data.data.items).toHaveLength(2);

    const page2 = await parseResponse(
      await GET(createMockRequest(getUrlWithOwner({ page: 2, pageSize: 2 }))),
    );
    expect(page2.data.data.items).toHaveLength(1);

    const page3 = await parseResponse(
      await GET(createMockRequest(getUrlWithOwner({ page: 3, pageSize: 2 }))),
    );
    expect(page3.data.data.items).toHaveLength(0);
  });

  it('applies status filter', async () => {
    const response = await GET(createMockRequest(getUrlWithOwner({ status: 'SETTLED' })));
    const result = await parseResponse(response);

    expect(result.data.data.items).toHaveLength(1);
    expect(result.data.data.items[0].status).toBe('SETTLED');
    expect(result.data.data.total).toBe(1);
  });

  it('applies type filter', async () => {
    const response = await GET(createMockRequest(getUrlWithOwner({ type: 'Safe' })));
    const result = await parseResponse(response);

    expect(result.data.data.items).toHaveLength(3);
  });

  it('applies minCompliance filter', async () => {
    const response = await GET(createMockRequest(getUrlWithOwner({ minCompliance: 50 })));
    const result = await parseResponse(response);

    expect(result.data.data.items).toHaveLength(2);
    expect(
      result.data.data.items.every((c: { complianceScore: number }) => c.complianceScore >= 50),
    ).toBe(true);
  });

  it('combines status and minCompliance filters', async () => {
    const response = await GET(
      createMockRequest(getUrlWithOwner({ status: 'ACTIVE', minCompliance: 50 })),
    );
    const result = await parseResponse(response);

    expect(result.data.data.items).toHaveLength(1);
    expect(result.data.data.items[0].status).toBe('ACTIVE');
    expect(result.data.data.items[0].complianceScore).toBe(85);
  });

  it('returns empty list when no commitments exist', async () => {
    mockedGetUserCommitmentsFromChain.mockResolvedValue([]);

    const response = await GET(createMockRequest(getUrlWithOwner()));
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.items).toHaveLength(0);
    expect(result.data.data.total).toBe(0);
  });

  it('returns 400 when ownerAddress is missing', async () => {
    const response = await GET(createMockRequest(`${BASE_URL}?page=1&pageSize=10`));
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
    expect(result.data.error.message).toBe('Invalid query parameters');
  });

  it('returns 400 when page is less than 1', async () => {
    const response = await GET(createMockRequest(getUrlWithOwner({ page: 0 })));
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when pageSize exceeds maximum of 100', async () => {
    const response = await GET(createMockRequest(getUrlWithOwner({ pageSize: 200 })));
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when status is not a valid enum value', async () => {
    const response = await GET(createMockRequest(getUrlWithOwner({ status: 'INVALID_STATUS' })));
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 429 when rate limited', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const response = await GET(createMockRequest(getUrlWithOwner()));
    const result = await parseResponse(response);

    expect(result.status).toBe(429);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('includes x-correlation-id in response headers', async () => {
    const response = await GET(createMockRequest(getUrlWithOwner()));

    expect(response.headers.get('x-correlation-id')).toBeDefined();
    expect(response.headers.get('x-request-id')).toBeDefined();
  });

  it('includes ETag header', async () => {
    const response = await GET(createMockRequest(getUrlWithOwner()));

    expect(response.headers.get('ETag')).toBeDefined();
    expect(response.headers.get('ETag')).toMatch(/^"/);
  });
});

describe('POST /api/commitments', () => {
  const validBody = {
    ownerAddress: VALID_ADDRESS,
    asset: 'USDC',
    amount: '1000',
    durationDays: 30,
    maxLossBps: 500,
  };

  const mockCreateResult: CreateCommitmentOnChainResult = {
    commitmentId: 'cm_new_123',
    commitment: {
      id: 'cm_new_123',
      ownerAddress: VALID_ADDRESS,
      asset: 'USDC',
      amount: '1000',
      status: 'CREATED',
      complianceScore: 0,
      currentValue: '0',
      feeEarned: '0',
      violationCount: 0,
    },
    txHash: 'tx_abc123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAssertMutationCsrf.mockReturnValue(undefined);
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedValidateSupportedAsset.mockReturnValue(undefined);
    mockedValidateStellarAddress.mockReturnValue(undefined);
    mockedCreateCommitmentOnChain.mockResolvedValue(mockCreateResult);
  });

  it('creates a commitment and returns 201 with DTO', async () => {
    const response = await POST(
      createMockRequest(BASE_URL, {
        method: 'POST',
        body: validBody,
      }),
    );
    const result = await parseResponse(response);

    expect(result.status).toBe(201);
    expect(result.data.success).toBe(true);
    expect(result.data.data).toMatchObject({
      commitmentId: 'cm_new_123',
      txHash: 'tx_abc123',
      commitment: expect.objectContaining({
        ownerAddress: VALID_ADDRESS,
        asset: 'USDC',
      }),
    });
    expect(result.data.meta).toMatchObject({
      correlationId: expect.any(String),
      timestamp: expect.any(String),
    });
  });

  it('calls createCommitmentOnChain with correct parameters', async () => {
    await POST(
      createMockRequest(BASE_URL, {
        method: 'POST',
        body: validBody,
      }),
    );

    expect(mockedCreateCommitmentOnChain).toHaveBeenCalledWith(
      {
        ownerAddress: VALID_ADDRESS,
        asset: 'USDC',
        amount: '1000',
        durationDays: 30,
        maxLossBps: 500,
        metadata: undefined,
      },
      expect.objectContaining({ requestId: expect.any(String) }),
    );
  });

  it('passes metadata when provided', async () => {
    const bodyWithMeta = {
      ...validBody,
      metadata: { source: 'test', ref: 'abc' },
    };

    await POST(
      createMockRequest(BASE_URL, {
        method: 'POST',
        body: bodyWithMeta,
      }),
    );

    expect(mockedCreateCommitmentOnChain).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { source: 'test', ref: 'abc' },
      }),
      expect.anything(),
    );
  });

  describe('request validation', () => {
    it('returns 400 for missing ownerAddress', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, ownerAddress: '' },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
      expect(result.data.error.code).toBe('BAD_REQUEST');
      expect(result.data.error.message).toContain('ownerAddress');
    });

    it('returns 400 for non-string ownerAddress', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, ownerAddress: 123 },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 for missing asset', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, asset: '' },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
      expect(result.data.error.code).toBe('BAD_REQUEST');
      expect(result.data.error.message).toContain('asset');
    });

    it('returns 400 for unsupported asset', async () => {
      mockedValidateSupportedAsset.mockImplementation(() => {
        throw new Error('Unsupported asset');
      });

      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, asset: 'ETH' },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
      expect(result.data.error.code).toBe('VALIDATION_ERROR');
      expect(result.data.error.message).toContain('not supported');
    });

    it('returns 400 for invalid Stellar address', async () => {
      mockedValidateStellarAddress.mockImplementation(() => {
        throw new Error('Invalid Stellar address');
      });

      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, ownerAddress: 'invalid-address' },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
      expect(result.data.error.code).toBe('BAD_REQUEST');
      expect(result.data.error.message).toContain('Stellar address');
    });

    it('returns 400 for invalid amount', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, amount: '' },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('BAD_REQUEST');
      expect(result.data.error.message).toContain('amount');
    });

    it('returns 400 for non-numeric amount', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, amount: 'not-a-number' },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 for invalid durationDays', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, durationDays: 0 },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('BAD_REQUEST');
      expect(result.data.error.message).toContain('durationDays');
    });

    it('returns 400 for negative maxLossBps', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, maxLossBps: -1 },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('BAD_REQUEST');
      expect(result.data.error.message).toContain('maxLossBps');
    });

    it('returns 400 for null maxLossBps', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, maxLossBps: null },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('security & guard rails', () => {
    it('returns 403 when CSRF validation fails', async () => {
      mockedAssertMutationCsrf.mockImplementation(() => {
        throw new CsrfValidationError('Missing CSRF token.', {
          reason: 'missing_header',
        });
      });

      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: validBody,
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(403);
      expect(result.data.success).toBe(false);
      expect(result.data.error.code).toBe('CSRF_INVALID');
    });

    it('returns 429 when rate limited', async () => {
      mockedCheckRateLimit.mockResolvedValue(false);

      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: validBody,
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(429);
      expect(result.data.success).toBe(false);
      expect(result.data.error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('returns 400 for empty body', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: {},
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
    });

    it('returns 400 for malformed JSON body', async () => {
      const req = new NextRequest(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-valid-json',
      });

      const response = await POST(req);
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
    });

    it('returns 400 for numeric amount that is NaN', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: { ...validBody, amount: 'NaN' },
        }),
      );
      const result = await parseResponse(response);

      expect(result.status).toBe(400);
      expect(result.data.error.code).toBe('BAD_REQUEST');
    });

    it('includes x-correlation-id in response headers', async () => {
      const response = await POST(
        createMockRequest(BASE_URL, {
          method: 'POST',
          body: validBody,
        }),
      );

      expect(response.headers.get('x-correlation-id')).toBeDefined();
    });
  });
});
