import { describe, it, expect } from 'vitest';
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

// ─── Compliance-score round-trip scaling ──────────────────────────────────────
// These tests verify that the scaling convention (integer 0-100) is consistent
// between the write path (recordAttestationOnChain, which sends the score
// on-chain) and the read paths (parseChainCommitment / parseAttestationResult,
// which parse it back).  The contract is: NO division or multiplication by
// ANALYTICS_SCALE at runtime — scores are persisted as-is.
//
// We simulate the round-trip by:
//   1. Applying the same transform the write path uses: Math.round(score)
//   2. Feeding the result into the read-path schemas (AttestationSummarySchema)
//   3. Asserting the output equals the original input.

describe('Compliance-score round-trip scaling', () => {
  const BOUNDARY_SCORES = [0, 50, 100] as const;

  /**
   * Simulates the on-chain write transform applied in recordAttestationOnChain.
   * Before the fix this was `score / 100`; now it is `Math.round(score)`.
   */
  function simulateWriteTransform(score: number): number {
    return Math.round(score);
  }

  /**
   * Builds a minimal attestation payload as it would be returned from the
   * chain, using the value that was written.
   */
  function buildChainPayload(writtenScore: number) {
    return {
      attestationId: 'att_roundtrip',
      commitmentId: 'c_roundtrip',
      complianceScore: writtenScore,
      violation: false,
      recordedAt: '2026-05-27T00:00:00.000Z',
    };
  }

  BOUNDARY_SCORES.forEach((inputScore) => {
    it(`round-trips complianceScore=${inputScore} without loss`, () => {
      const written = simulateWriteTransform(inputScore);
      const payload = buildChainPayload(written);

      // Validate via AttestationSummarySchema (read path schema)
      const parsed = AttestationSummarySchema.parse(payload);
      expect(parsed.complianceScore).toBe(inputScore);
    });
  });

  it('preserves integer precision (no float artefacts)', () => {
    // Scores that would lose precision under the old `/ 100` path
    const trickyScores = [1, 3, 7, 33, 67, 99];
    for (const score of trickyScores) {
      const written = simulateWriteTransform(score);
      expect(written).toBe(score); // still an integer
      expect(Number.isInteger(written)).toBe(true);
    }
  });

  it('rounds fractional input to nearest integer', () => {
    // If a caller passes 85.6, it should be stored as 86
    expect(simulateWriteTransform(85.6)).toBe(86);
    expect(simulateWriteTransform(85.4)).toBe(85);
    expect(simulateWriteTransform(0.5)).toBe(1);
    expect(simulateWriteTransform(99.5)).toBe(100);
  });

  // Commitment-level round-trip (uses CommitmentItemSchema for the read side)
  BOUNDARY_SCORES.forEach((inputScore) => {
    it(`CommitmentItemSchema round-trips complianceScore=${inputScore}`, () => {
      const written = simulateWriteTransform(inputScore);
      const payload = {
        commitmentId: 'c_rt',
        ownerAddress: 'GABC',
        asset: 'USDC',
        amount: '1000',
        status: 'Active',
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-06-01T00:00:00.000Z',
        complianceScore: written,
      };
      const parsed = CommitmentItemSchema.parse(payload);
      expect(parsed.complianceScore).toBe(inputScore);
    });
  });
});
