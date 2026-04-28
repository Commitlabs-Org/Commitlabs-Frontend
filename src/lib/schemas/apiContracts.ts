import { z } from 'zod';

// ─── Envelope schemas ─────────────────────────────────────────────────────────

export const ErrorBodySchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

export function OkBodySchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.record(z.string(), z.unknown()).optional(),
  });
}

// ─── Domain schemas ───────────────────────────────────────────────────────────

export const HealthResponseSchema = OkBodySchema(
  z.object({
    status: z.string(),
    timestamp: z.string().datetime(),
  }),
);

export const CommitmentItemSchema = z.object({
  commitmentId: z.string(),
  ownerAddress: z.string(),
  asset: z.string(),
  amount: z.union([z.string(), z.number()]),
  status: z.string(),
  complianceScore: z.number().optional(),
  currentValue: z.union([z.string(), z.number(), z.bigint()]).optional(),
  feeEarned: z.unknown().optional(),
  violationCount: z.number().optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export const CommitmentsListResponseSchema = OkBodySchema(
  z.object({
    items: z.array(CommitmentItemSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  }),
);

export const CommitmentDetailSchema = z.object({
  commitmentId: z.string(),
  owner: z.string(),
  rules: z.record(z.string(), z.unknown()),
  amount: z.string(),
  asset: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  currentValue: z.string(),
  status: z.string(),
  daysRemaining: z.number().int().min(0),
  drawdownPercent: z.number().optional(),
  maxLossPercent: z.number().nullable(),
  tokenId: z.string().optional(),
  nftMetadataLink: z.string().optional(),
});

export const CommitmentDetailResponseSchema = OkBodySchema(CommitmentDetailSchema);

export const MarketplaceListingCardSchema = z.object({
  id: z.string(),
  type: z.string(),
  score: z.number(),
  amount: z.string(),
  duration: z.string(),
  yield: z.string(),
  maxLoss: z.string(),
  price: z.string(),
});

export const MarketplaceListingsResponseSchema = OkBodySchema(
  z.object({
    listings: z.array(z.record(z.string(), z.unknown())),
    cards: z.array(MarketplaceListingCardSchema),
    total: z.number().int().nonnegative(),
  }),
);

export const AttestationSummarySchema = z.object({
  attestationId: z.string(),
  commitmentId: z.string(),
  complianceScore: z.number(),
  violation: z.boolean(),
  feeEarned: z.string().optional(),
  recordedAt: z.string(),
});

export const AttestationPostResponseSchema = OkBodySchema(
  z.object({
    attestation: AttestationSummarySchema,
    txReference: z.string().nullable(),
  }),
);
