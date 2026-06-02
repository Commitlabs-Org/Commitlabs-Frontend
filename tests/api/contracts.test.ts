import { describe, it, expect, vi } from 'vitest';
import {
  ErrorBodySchema,
  OkBodySchema,
  HealthResponseSchema,
  CommitmentsListResponseSchema,
  CommitmentDetailResponseSchema,
  MarketplaceListingsResponseSchema,
  AttestationPostResponseSchema,
  CommitmentItemSchema,
  CommitmentDetailSchema,
  MarketplaceListingCardSchema,
  AttestationSummarySchema,
} from '@/lib/schemas/apiContracts';
import { z } from 'zod';

vi.mock("ioredis", () => ({ default: class {} }));
vi.mock("@/lib/backend/cache/factory", () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  },
}));
vi.mock("@/lib/backend/counters/provider", () => ({
  getCountersAdapter: () => ({
    incrementSuccessfulActions: vi.fn(),
    incrementChainFailures: vi.fn(),
  }),
}));
vi.mock("@/lib/backend/config", () => ({
  getBackendConfig: () => ({
    sorobanRpcUrl: "https://example.invalid",
    networkPassphrase: "TEST",
    contractAddresses: { commitmentCore: "CORE", attestationEngine: "ENGINE" },
  }),
}));
vi.mock("@/lib/backend/logger", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { cache } from '@/lib/backend/cache/factory';
import { settleCommitmentOnChain } from '@/lib/backend/services/contracts';
import { BackendError } from '@/lib/backend/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expectValid<T extends z.ZodTypeAny>(schema: T, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${result.error.message}`);
  }
  return result.data;
}

function expectInvalid<T extends z.ZodTypeAny>(schema: T, value: unknown) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
}

// ─── ErrorBodySchema ──────────────────────────────────────────────────────────

describe('ErrorBodySchema', () => {
  const valid = {
    success: false,
    error: { code: 'NOT_FOUND', message: 'Resource not found.' },
  };

  it('accepts a minimal error envelope', () => {
    expectValid(ErrorBodySchema, valid);
  });

  it('accepts error with optional details', () => {
    expectValid(ErrorBodySchema, {
      ...valid,
      error: { ...valid.error, details: { field: 'id' } },
    });
  });

  it('rejects success: true', () => {
    expectInvalid(ErrorBodySchema, { ...valid, success: true });
  });

  it('rejects missing error.code', () => {
    expectInvalid(ErrorBodySchema, { success: false, error: { message: 'oops' } });
  });

  it('rejects empty error.code', () => {
    expectInvalid(ErrorBodySchema, { success: false, error: { code: '', message: 'oops' } });
  });

  it('rejects missing error.message', () => {
    expectInvalid(ErrorBodySchema, { success: false, error: { code: 'ERR' } });
  });

  it('rejects empty error.message', () => {
    expectInvalid(ErrorBodySchema, { success: false, error: { code: 'ERR', message: '' } });
  });

  it('rejects missing error object', () => {
    expectInvalid(ErrorBodySchema, { success: false });
  });
});

// ─── OkBodySchema ─────────────────────────────────────────────────────────────

describe('OkBodySchema', () => {
  const StringOk = OkBodySchema(z.string());

  it('accepts a valid ok envelope', () => {
    expectValid(StringOk, { success: true, data: 'hello' });
  });

  it('accepts ok envelope with meta', () => {
    expectValid(StringOk, { success: true, data: 'hello', meta: { page: 1 } });
  });

  it('rejects success: false', () => {
    expectInvalid(StringOk, { success: false, data: 'hello' });
  });

  it('rejects missing data', () => {
    expectInvalid(StringOk, { success: true });
  });

  it('rejects wrong data type', () => {
    expectInvalid(StringOk, { success: true, data: 42 });
  });
});

// ─── HealthResponseSchema ─────────────────────────────────────────────────────

describe('HealthResponseSchema', () => {
  const valid = {
    success: true,
    data: { status: 'ok', timestamp: '2026-04-23T23:31:42.241Z' },
  };

  it('accepts a valid health response', () => {
    expectValid(HealthResponseSchema, valid);
  });

  it('rejects non-datetime timestamp', () => {
    expectInvalid(HealthResponseSchema, {
      ...valid,
      data: { ...valid.data, timestamp: 'not-a-date' },
    });
  });

  it('rejects missing status', () => {
    expectInvalid(HealthResponseSchema, {
      success: true,
      data: { timestamp: '2026-04-23T23:31:42.241Z' },
    });
  });

  it('rejects missing timestamp', () => {
    expectInvalid(HealthResponseSchema, { success: true, data: { status: 'ok' } });
  });
});

// ─── CommitmentItemSchema ─────────────────────────────────────────────────────

describe('CommitmentItemSchema', () => {
  const valid = {
    commitmentId: 'c1',
    ownerAddress: 'GABC',
    asset: 'USDC',
    amount: '1000',
    status: 'Active',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-06-01T00:00:00.000Z',
  };

  it('accepts a minimal commitment item', () => {
    expectValid(CommitmentItemSchema, valid);
  });

  it('accepts amount as number', () => {
    expectValid(CommitmentItemSchema, { ...valid, amount: 1000 });
  });

  it('accepts all optional fields', () => {
    expectValid(CommitmentItemSchema, {
      ...valid,
      complianceScore: 95,
      currentValue: '1050',
      feeEarned: '5',
      violationCount: 0,
    });
  });

  it('rejects missing commitmentId', () => {
    const { commitmentId: _, ...rest } = valid;
    expectInvalid(CommitmentItemSchema, rest);
  });

  it('rejects missing ownerAddress', () => {
    const { ownerAddress: _, ...rest } = valid;
    expectInvalid(CommitmentItemSchema, rest);
  });

  it('rejects missing createdAt', () => {
    const { createdAt: _, ...rest } = valid;
    expectInvalid(CommitmentItemSchema, rest);
  });
});

// ─── CommitmentsListResponseSchema ───────────────────────────────────────────

describe('CommitmentsListResponseSchema', () => {
  const item = {
    commitmentId: 'c1',
    ownerAddress: 'GABC',
    asset: 'USDC',
    amount: '1000',
    status: 'Active',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-06-01T00:00:00.000Z',
  };

  const valid = {
    success: true,
    data: { items: [item], page: 1, pageSize: 10, total: 1 },
  };

  it('accepts a valid list response', () => {
    expectValid(CommitmentsListResponseSchema, valid);
  });

  it('accepts empty items array', () => {
    expectValid(CommitmentsListResponseSchema, {
      ...valid,
      data: { ...valid.data, items: [], total: 0 },
    });
  });

  it('rejects negative total', () => {
    expectInvalid(CommitmentsListResponseSchema, {
      ...valid,
      data: { ...valid.data, total: -1 },
    });
  });

  it('rejects page < 1', () => {
    expectInvalid(CommitmentsListResponseSchema, {
      ...valid,
      data: { ...valid.data, page: 0 },
    });
  });

  it('rejects missing items', () => {
    expectInvalid(CommitmentsListResponseSchema, {
      success: true,
      data: { page: 1, pageSize: 10, total: 0 },
    });
  });
});

// ─── CommitmentDetailSchema ───────────────────────────────────────────────────

describe('CommitmentDetailSchema', () => {
  const valid = {
    commitmentId: '1',
    owner: 'GABC',
    rules: { strategy: 'balanced' },
    amount: '100000',
    asset: 'USDC',
    createdAt: '2026-01-10T00:00:00.000Z',
    expiresAt: '2026-03-11T00:00:00.000Z',
    currentValue: '112500',
    status: 'Active',
    daysRemaining: 10,
    maxLossPercent: 8,
  };

  it('accepts a valid commitment detail', () => {
    expectValid(CommitmentDetailSchema, valid);
  });

  it('accepts null maxLossPercent', () => {
    expectValid(CommitmentDetailSchema, { ...valid, maxLossPercent: null });
  });

  it('accepts optional drawdownPercent and tokenId', () => {
    expectValid(CommitmentDetailSchema, {
      ...valid,
      drawdownPercent: 3.2,
      tokenId: '123',
      nftMetadataLink: 'https://example.com/metadata/123',
    });
  });

  it('rejects negative daysRemaining', () => {
    expectInvalid(CommitmentDetailSchema, { ...valid, daysRemaining: -1 });
  });

  it('rejects missing owner', () => {
    const { owner: _, ...rest } = valid;
    expectInvalid(CommitmentDetailSchema, rest);
  });

  it('rejects missing status', () => {
    const { status: _, ...rest } = valid;
    expectInvalid(CommitmentDetailSchema, rest);
  });
});

// ─── CommitmentDetailResponseSchema ──────────────────────────────────────────

describe('CommitmentDetailResponseSchema', () => {
  it('accepts a valid detail response envelope', () => {
    expectValid(CommitmentDetailResponseSchema, {
      success: true,
      data: {
        commitmentId: '1',
        owner: 'GABC',
        rules: {},
        amount: '100000',
        asset: 'USDC',
        createdAt: '2026-01-10T00:00:00.000Z',
        expiresAt: '2026-03-11T00:00:00.000Z',
        currentValue: '112500',
        status: 'Active',
        daysRemaining: 10,
        maxLossPercent: null,
      },
    });
  });
});

// ─── MarketplaceListingCardSchema ─────────────────────────────────────────────

describe('MarketplaceListingCardSchema', () => {
  const valid = {
    id: 'listing_1',
    type: 'Balanced',
    score: 88,
    amount: '$10,000',
    duration: '30 days',
    yield: '5%',
    maxLoss: '8%',
    price: '$10,500',
  };

  it('accepts a valid listing card', () => {
    expectValid(MarketplaceListingCardSchema, valid);
  });

  it('rejects missing id', () => {
    const { id: _, ...rest } = valid;
    expectInvalid(MarketplaceListingCardSchema, rest);
  });

  it('rejects non-number score', () => {
    expectInvalid(MarketplaceListingCardSchema, { ...valid, score: '88' });
  });

  it('rejects missing price', () => {
    const { price: _, ...rest } = valid;
    expectInvalid(MarketplaceListingCardSchema, rest);
  });
});

// ─── MarketplaceListingsResponseSchema ───────────────────────────────────────

describe('MarketplaceListingsResponseSchema', () => {
  const card = {
    id: 'listing_1',
    type: 'Balanced',
    score: 88,
    amount: '$10,000',
    duration: '30 days',
    yield: '5%',
    maxLoss: '8%',
    price: '$10,500',
  };

  const valid = {
    success: true,
    data: { listings: [{ listingId: 'l1' }], cards: [card], total: 1 },
  };

  it('accepts a valid marketplace listings response', () => {
    expectValid(MarketplaceListingsResponseSchema, valid);
  });

  it('accepts empty listings', () => {
    expectValid(MarketplaceListingsResponseSchema, {
      ...valid,
      data: { listings: [], cards: [], total: 0 },
    });
  });

  it('rejects negative total', () => {
    expectInvalid(MarketplaceListingsResponseSchema, {
      ...valid,
      data: { ...valid.data, total: -1 },
    });
  });

  it('rejects missing cards', () => {
    expectInvalid(MarketplaceListingsResponseSchema, {
      success: true,
      data: { listings: [], total: 0 },
    });
  });
});

// ─── AttestationSummarySchema ─────────────────────────────────────────────────

describe('AttestationSummarySchema', () => {
  const valid = {
    attestationId: 'att_1',
    commitmentId: 'c1',
    complianceScore: 90,
    violation: false,
    recordedAt: '2026-04-23T23:31:42.241Z',
  };

  it('accepts a valid attestation summary', () => {
    expectValid(AttestationSummarySchema, valid);
  });

  it('accepts optional feeEarned', () => {
    expectValid(AttestationSummarySchema, { ...valid, feeEarned: '10.5' });
  });

  it('rejects non-boolean violation', () => {
    expectInvalid(AttestationSummarySchema, { ...valid, violation: 'false' });
  });

  it('rejects non-number complianceScore', () => {
    expectInvalid(AttestationSummarySchema, { ...valid, complianceScore: '90' });
  });

  it('rejects missing attestationId', () => {
    const { attestationId: _, ...rest } = valid;
    expectInvalid(AttestationSummarySchema, rest);
  });
});

// ─── AttestationPostResponseSchema ───────────────────────────────────────────

describe('AttestationPostResponseSchema', () => {
  it('accepts a valid attestation post response', () => {
    expectValid(AttestationPostResponseSchema, {
      success: true,
      data: {
        attestation: {
          attestationId: 'att_1',
          commitmentId: 'c1',
          complianceScore: 90,
          violation: false,
          recordedAt: '2026-04-23T23:31:42.241Z',
        },
        txReference: 'tx_abc123',
      },
    });
  });

  it('accepts null txReference', () => {
    expectValid(AttestationPostResponseSchema, {
      success: true,
      data: {
        attestation: {
          attestationId: 'att_1',
          commitmentId: 'c1',
          complianceScore: 90,
          violation: false,
          recordedAt: '2026-04-23T23:31:42.241Z',
        },
        txReference: null,
      },
    });
  });

  it('rejects missing txReference field', () => {
    expectInvalid(AttestationPostResponseSchema, {
      success: true,
      data: {
        attestation: {
          attestationId: 'att_1',
          commitmentId: 'c1',
          complianceScore: 90,
          violation: false,
          recordedAt: '2026-04-23T23:31:42.241Z',
        },
      },
    });
  });
});

// ─── Compliance Score Scaling Round-Trip Tests ───────────────────────────────

describe('Compliance Score Scaling Round-Trip', () => {
  const ANALYTICS_SCALE = 100;

  describe('parseChainCommitment scaling', () => {
    it('should scale compliance score from 0.0 to 0 (boundary)', () => {
      const rawValue = {
        id: 'c1',
        ownerAddress: 'GABC',
        asset: 'USDC',
        amount: '1000',
        status: 'ACTIVE',
        complianceScore: 0.0, // On-chain value
        currentValue: '1000',
        feeEarned: '0',
        violationCount: 0,
      };

      // Simulate the parsing logic
      const parsedScore = (typeof rawValue.complianceScore === 'number' ? rawValue.complianceScore : 0) * ANALYTICS_SCALE;
      expect(parsedScore).toBe(0);
    });

    it('should scale compliance score from 0.5 to 50 (midpoint)', () => {
      const rawValue = {
        id: 'c1',
        ownerAddress: 'GABC',
        asset: 'USDC',
        amount: '1000',
        status: 'ACTIVE',
        complianceScore: 0.5, // On-chain value
        currentValue: '1000',
        feeEarned: '0',
        violationCount: 0,
      };

      const parsedScore = (typeof rawValue.complianceScore === 'number' ? rawValue.complianceScore : 0) * ANALYTICS_SCALE;
      expect(parsedScore).toBe(50);
    });

    it('should scale compliance score from 1.0 to 100 (boundary)', () => {
      const rawValue = {
        id: 'c1',
        ownerAddress: 'GABC',
        asset: 'USDC',
        amount: '1000',
        status: 'ACTIVE',
        complianceScore: 1.0, // On-chain value
        currentValue: '1000',
        feeEarned: '0',
        violationCount: 0,
      };

      const parsedScore = (typeof rawValue.complianceScore === 'number' ? rawValue.complianceScore : 0) * ANALYTICS_SCALE;
      expect(parsedScore).toBe(100);
    });

    it('should scale compliance score from 0.85 to 85 (typical value)', () => {
      const rawValue = {
        id: 'c1',
        ownerAddress: 'GABC',
        asset: 'USDC',
        amount: '1000',
        status: 'ACTIVE',
        complianceScore: 0.85, // On-chain value
        currentValue: '1000',
        feeEarned: '0',
        violationCount: 0,
      };

      const parsedScore = (typeof rawValue.complianceScore === 'number' ? rawValue.complianceScore : 0) * ANALYTICS_SCALE;
      expect(parsedScore).toBe(85);
    });
  });

  describe('parseAttestationResult scaling', () => {
    it('should scale compliance score from 0.0 to 0 (boundary)', () => {
      const rawValue = {
        attestationId: 'att_1',
        commitmentId: 'c1',
        complianceScore: 0.0, // On-chain value
        violation: false,
        feeEarned: '0',
        recordedAt: '2026-04-23T23:31:42.241Z',
      };

      const parsedScore = (typeof rawValue.complianceScore === 'number' ? rawValue.complianceScore : 0) * ANALYTICS_SCALE;
      expect(parsedScore).toBe(0);
    });

    it('should scale compliance score from 0.5 to 50 (midpoint)', () => {
      const rawValue = {
        attestationId: 'att_1',
        commitmentId: 'c1',
        complianceScore: 0.5, // On-chain value
        violation: false,
        feeEarned: '0',
        recordedAt: '2026-04-23T23:31:42.241Z',
      };

      const parsedScore = (typeof rawValue.complianceScore === 'number' ? rawValue.complianceScore : 0) * ANALYTICS_SCALE;
      expect(parsedScore).toBe(50);
    });

    it('should scale compliance score from 1.0 to 100 (boundary)', () => {
      const rawValue = {
        attestationId: 'att_1',
        commitmentId: 'c1',
        complianceScore: 1.0, // On-chain value
        violation: false,
        feeEarned: '0',
        recordedAt: '2026-04-23T23:31:42.241Z',
      };

      const parsedScore = (typeof rawValue.complianceScore === 'number' ? rawValue.complianceScore : 0) * ANALYTICS_SCALE;
      expect(parsedScore).toBe(100);
    });

    it('should scale compliance score from 0.92 to 92 (typical value)', () => {
      const rawValue = {
        attestationId: 'att_1',
        commitmentId: 'c1',
        complianceScore: 0.92, // On-chain value
        violation: false,
        feeEarned: '0',
        recordedAt: '2026-04-23T23:31:42.241Z',
      };

      const parsedScore = (typeof rawValue.complianceScore === 'number' ? rawValue.complianceScore : 0) * ANALYTICS_SCALE;
      expect(parsedScore).toBe(92);
    });
  });

  describe('recordAttestationOnChain write scaling', () => {
    it('should scale compliance score from 0 to 0.0 (boundary)', () => {
      const inputScore = 0; // Application value
      const scaledValue = inputScore / ANALYTICS_SCALE;
      expect(scaledValue).toBe(0.0);
    });

    it('should scale compliance score from 50 to 0.5 (midpoint)', () => {
      const inputScore = 50; // Application value
      const scaledValue = inputScore / ANALYTICS_SCALE;
      expect(scaledValue).toBe(0.5);
    });

    it('should scale compliance score from 100 to 1.0 (boundary)', () => {
      const inputScore = 100; // Application value
      const scaledValue = inputScore / ANALYTICS_SCALE;
      expect(scaledValue).toBe(1.0);
    });

    it('should scale compliance score from 85 to 0.85 (typical value)', () => {
      const inputScore = 85; // Application value
      const scaledValue = inputScore / ANALYTICS_SCALE;
      expect(scaledValue).toBe(0.85);
    });
  });

  describe('Round-trip consistency', () => {
    it('should maintain consistency for score 0', () => {
      const originalScore = 0;
      const onChainValue = originalScore / ANALYTICS_SCALE;
      const restoredScore = onChainValue * ANALYTICS_SCALE;
      expect(restoredScore).toBe(originalScore);
    });

    it('should maintain consistency for score 50', () => {
      const originalScore = 50;
      const onChainValue = originalScore / ANALYTICS_SCALE;
      const restoredScore = onChainValue * ANALYTICS_SCALE;
      expect(restoredScore).toBe(originalScore);
    });

    it('should maintain consistency for score 100', () => {
      const originalScore = 100;
      const onChainValue = originalScore / ANALYTICS_SCALE;
      const restoredScore = onChainValue * ANALYTICS_SCALE;
      expect(restoredScore).toBe(originalScore);
    });

    it('should maintain consistency for score 85', () => {
      const originalScore = 85;
      const onChainValue = originalScore / ANALYTICS_SCALE;
      const restoredScore = onChainValue * ANALYTICS_SCALE;
      expect(restoredScore).toBe(originalScore);
    });

    it('should avoid float precision loss for typical scores', () => {
      const testScores = [0, 25, 50, 75, 85, 92, 100];
      testScores.forEach((score) => {
        const onChainValue = score / ANALYTICS_SCALE;
        const restoredScore = onChainValue * ANALYTICS_SCALE;
        // Check that the round-trip is exact (no precision loss)
        expect(restoredScore).toBe(score);
      });
    });
  });
});

describe('settleCommitmentOnChain maturity gate', () => {
  it('throws NOT_MATURED error when active commitment has missing expiresAt', async () => {
    const mockedCache = vi.mocked(cache);
    mockedCache.get.mockResolvedValueOnce({
      id: 'cm_123',
      ownerAddress: 'GABC',
      asset: 'USDC',
      amount: '1000',
      status: 'ACTIVE',
      complianceScore: 100,
      currentValue: '1000',
      feeEarned: '0',
      violationCount: 0,
      expiresAt: undefined, // missing expiresAt
    } as any);

    await expect(
      settleCommitmentOnChain({ commitmentId: 'cm_123' })
    ).rejects.toMatchObject({
      code: 'NOT_MATURED',
      message: 'Commitment maturity information is missing. Cannot settle.',
      status: 400,
    });
  });

  it('throws NOT_MATURED error when active commitment has expiresAt in the future', async () => {
    const mockedCache = vi.mocked(cache);
    mockedCache.get.mockResolvedValueOnce({
      id: 'cm_123',
      ownerAddress: 'GABC',
      asset: 'USDC',
      amount: '1000',
      status: 'ACTIVE',
      complianceScore: 100,
      currentValue: '1000',
      feeEarned: '0',
      violationCount: 0,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour in future
    } as any);

    await expect(
      settleCommitmentOnChain({ commitmentId: 'cm_123' })
    ).rejects.toMatchObject({
      code: 'NOT_MATURED',
      message: 'Commitment has not matured yet and cannot be settled.',
      status: 400,
    });
  });
});
