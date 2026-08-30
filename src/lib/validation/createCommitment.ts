import { z } from 'zod';

export const VALID_COMMITMENT_TYPES = ['safe', 'balanced', 'aggressive'] as const;
export type CommitmentType = (typeof VALID_COMMITMENT_TYPES)[number];

export const SUPPORTED_ASSETS = ['XLM', 'USDC'] as const;
export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

export const SourceIdSchema = z
  .string()
  .trim()
  .min(1, 'sourceId is required')
  .max(64, 'sourceId too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid sourceId format');

export const AssetSchema = z.enum(SUPPORTED_ASSETS);

export const CommitmentTypeSchema = z.enum(VALID_COMMITMENT_TYPES);

// Strict decimal: 1 to 7 fractional digits, no exponent, no +/- prefix
export const AmountSchema = z
  .string()
  .trim()
  .min(1, 'Amount is required')
  .regex(/^\d+(\.\d{1,7})?$/, 'Invalid amount format')
  .refine((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= 1_000_000;
  }, 'Amount must be finite >0 and <= 1_000_000');

export function parseAmountStrict(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const result = AmountSchema.safeParse(trimmed);
  if (!result.success) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (trimmed.toLowerCase() === 'infinity' || trimmed.toLowerCase() === 'nan') return null;
  return n;
}

export const DurationDaysSchema = z.number().int().min(1).max(365);
export const MaxLossPercentSchema = z.number().min(0).max(100);

export const DraftStateSchema = z.object({
  step: z.number().int().min(1).max(3),
  selectedType: z.enum(VALID_COMMITMENT_TYPES).nullable(),
  commitmentType: z.enum(VALID_COMMITMENT_TYPES),
  amount: z.string().max(64),
  asset: z.string().min(1).max(16),
  durationDays: z.number().int().min(1).max(365),
  maxLossPercent: z.number().min(0).max(100),
});

// Extended draft with wallet binding & integrity
export const PersistedDraftStateSchema = DraftStateSchema.extend({
  walletAddress: z.string().optional(),
  networkPassphrase: z.string().nullable().optional(),
  version: z.number().int().optional(),
});

export const NamedDraftSchema = z.object({
  id: z.string().min(1),
  data: PersistedDraftStateSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const DraftMapSchema = z.record(NamedDraftSchema);

export const PrefillDataSchema = z.object({
  commitmentType: z.enum(VALID_COMMITMENT_TYPES),
  amount: z.string(),
  asset: z.string(),
  durationDays: z.number().int().min(1).max(365),
  maxLossPercent: z.number().min(0).max(100),
});

export const ValidatePrefillResponseSchema = z.object({
  commitmentType: z.enum(VALID_COMMITMENT_TYPES).optional(),
  amount: z.unknown().optional(),
  asset: z.unknown().optional(),
  durationDays: z.unknown().optional(),
  maxLossPercent: z.unknown().optional(),
  // identity fields must not be copied - optional unknown
  id: z.unknown().optional(),
  ownerAddress: z.unknown().optional(),
  onChainState: z.unknown().optional(),
});

export const CreatePayloadSchema = z.object({
  ownerAddress: z.string().min(1),
  asset: z.enum(SUPPORTED_ASSETS),
  amount: z.string().regex(/^\d+(\.\d{1,7})?$/),
  durationDays: z.number().int().min(1).max(365),
  maxLossBps: z.number().int().min(0).max(10000),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z
    .object({
      commitmentId: z.string().min(1),
      txHash: z.string().optional(),
      reference: z.string().optional(),
    })
    .passthrough(),
});

export const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid idempotency key');

export function isValidSourceId(value: unknown): boolean {
  return SourceIdSchema.safeParse(value).success;
}

export function validateDraftState(data: unknown): { valid: boolean; error?: string } {
  const r = DraftStateSchema.safeParse(data);
  if (r.success) return { valid: true };
  return { valid: false, error: r.error.issues[0]?.message };
}

export function clampDurationDays(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 90;
  return Math.min(365, Math.max(1, Math.trunc(v)));
}

export function clampMaxLossPercent(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 100;
  return Math.min(100, Math.max(0, v));
}
