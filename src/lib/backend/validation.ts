import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";
import { PARAMETER_BOUNDS, SUPPORTED_ASSETS } from "./config";

// ─── Warning types ────────────────────────────────────────────────────────────

export type WarningCode =
  | "HIGH_RISK_LOSS_TOLERANCE"
  | "UNUSUAL_DURATION"
  | "UNUSUAL_AMOUNT"
  | "LOW_COMPLIANCE_SCORE"
  | "DUPLICATE_COMMITMENT";

export interface ValidationWarning {
  code: WarningCode;
  message: string;
  field?: string;
}

export interface ValidatedCommitmentDraft {
  ownerAddress: string;
  asset: string;
  amount: number;
  durationDays: number;
  maxLossBps: number;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationWarning[];
  warnings: ValidationWarning[];
  data?: ValidatedCommitmentDraft;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}


const amountSchema = z.union([z.string(), z.number()]).transform((val) => {
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num) || num <= 0) {
    throw new Error("Amount must be a positive number");
  }
  return num;
});

const addressSchema = z
  .string()
  .trim()
  .refine((addr) => StrKey.isValidEd25519PublicKey(addr), {
    message: "Must be a valid Stellar address (G... format).",
  });

const paginationSchema = z
  .object({
    page: z
      .union([z.string(), z.number()])
      .optional()
      .default(1)
      .transform((val) => {
        const num = typeof val === "string" ? parseInt(val, 10) : val;
        if (isNaN(num) || num < 1) {
          throw new Error("Page must be a positive integer");
        }
        return num;
      }),
    limit: z
      .union([z.string(), z.number()])
      .optional()
      .default(10)
      .transform((val) => {
        const num = typeof val === "string" ? parseInt(val, 10) : val;
        if (isNaN(num) || num < 1 || num > 100) {
          throw new Error("Limit must be between 1 and 100");
        }
        return num;
      }),
  })
  .transform((data) => ({
    page: data.page,
    limit: data.limit,
  }));

export const createCommitmentSchemaOld = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  amount: amountSchema,
  creatorAddress: addressSchema,
});

export const createMarketplaceListingSchemaOld = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  price: amountSchema,
  category: z.string().min(1, "Category is required"),
  sellerAddress: addressSchema,
});

const DisputeReasonSchema = z.object({
    reason: z.string().min(1, "Dispute reason is required").max(500, "Reason must be 500 characters or less"),
    evidence: z.string().optional(),
});

const ResolveDisputeSchema = z.object({
    resolution: z.enum(["resolved_in_favor_of_owner", "resolved_in_favor_of_counterparty", "dismissed"]),
    notes: z.string().max(1000, "Notes must be 1000 characters or less").optional(),
});

export { DisputeReasonSchema, ResolveDisputeSchema };
export type DisputeReasonInput = z.infer<typeof DisputeReasonSchema>;
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;
export type FilterParams = Record<string, string | number | boolean>;

const addressSchema2 = z
  .string()
  .trim()
  .refine((addr) => StrKey.isValidEd25519PublicKey(addr), {
    message: "Must be a valid Stellar address (G... format).",
  });

const amountSchema2 = z.coerce
  .number()
  .positive("Amount must be a positive number");

const paginationSchema2 = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const supportedAssetCodes = SUPPORTED_ASSETS.map((asset) => asset.code);

export const createCommitmentSchema = z.object({
  ownerAddress: addressSchema2,
  asset: z
    .string()
    .trim()
    .transform((asset) => asset.toUpperCase())
    .refine((asset) => supportedAssetCodes.includes(asset), {
      message: `Asset is not supported. Supported assets: ${supportedAssetCodes.join(", ")}.`,
    }),
  amount: amountSchema2,
  durationDays: z.coerce
    .number()
    .int()
    .min(PARAMETER_BOUNDS.durationDays.min)
    .max(PARAMETER_BOUNDS.durationDays.max),
  maxLossBps: z.coerce.number().min(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createMarketplaceListingSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  price: amountSchema2,
  category: z.string().trim().min(1, "Category is required"),
  sellerAddress: addressSchema2,
});

export const createAttestationSchema = z.object({
  commitmentId: z.string().min(1, "Commitment ID is required"),
  attesterAddress: z.string().trim().refine((addr) => StrKey.isValidEd25519PublicKey(addr), {
    message: "Must be a valid Stellar address (G... format).",
  }),
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().optional(),
});

export type CreateAttestationInput = z.infer<typeof createAttestationSchema>;

// ─── Commitment draft validation schema ──────────────────────────────────────

const commitmentDraftInputSchema = z.object({
  ownerAddress: z.string().min(1, "Owner address is required"),
  asset: z.string().min(1, "Asset is required"),
  amount: z.unknown(),
  durationDays: z.unknown(),
  maxLossBps: z.unknown(),
});

export function validateCommitmentDraft(
  input: unknown
): ValidationResult {
  const errors: ValidationWarning[] = [];

  const parsed = commitmentDraftInputSchema.safeParse(input);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        code: "VALIDATION_ERROR" as WarningCode,
        message: issue.message,
        field: issue.path.join("."),
      });
    }
    return { valid: false, errors, warnings: [] };
  }

  const rawData = parsed.data;

  const amount = typeof rawData.amount === "string" ? parseFloat(rawData.amount) : rawData.amount;
  const durationDays = typeof rawData.durationDays === "string" ? parseInt(rawData.durationDays, 10) : rawData.durationDays;
  const maxLossBps = typeof rawData.maxLossBps === "string" ? parseFloat(rawData.maxLossBps) : rawData.maxLossBps;

  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    return {
      valid: false,
      errors: [
        {
          code: "VALIDATION_ERROR" as WarningCode,
          message: "Amount must be a positive number",
          field: "amount",
        },
      ],
      warnings: [],
    };
  }

  if (typeof durationDays !== "number" || isNaN(durationDays) || !Number.isInteger(durationDays) || durationDays <= 0) {
    return {
      valid: false,
      errors: [
        {
          code: "VALIDATION_ERROR" as WarningCode,
          message: "Duration must be a positive integer",
          field: "durationDays",
        },
      ],
      warnings: [],
    };
  }

  if (typeof maxLossBps !== "number" || isNaN(maxLossBps) || maxLossBps < 0) {
    return {
      valid: false,
      errors: [
        {
          code: "VALIDATION_ERROR" as WarningCode,
          message: "Max loss must be a non-negative number",
          field: "maxLossBps",
        },
      ],
      warnings: [],
    };
  }

  if (!StrKey.isValidEd25519PublicKey(rawData.ownerAddress)) {
    return {
      valid: false,
      errors: [
        {
          code: "VALIDATION_ERROR" as WarningCode,
          message: "Invalid Stellar address format",
          field: "ownerAddress",
        },
      ],
      warnings: [],
    };
  }

  const data: ValidatedCommitmentDraft = {
    ownerAddress: rawData.ownerAddress,
    asset: rawData.asset,
    amount,
    durationDays,
    maxLossBps,
  };

  const warnings = checkWarnings(data);

  return {
    valid: true,
    errors: [],
    warnings,
    data,
  };
}

export type CommitmentDraftInput = z.infer<typeof commitmentDraftInputSchema>;

// ─── Warning rules ────────────────────────────────────────────────────────────

const HIGH_RISK_THRESHOLD_BPS = 5000;
const UNUSUAL_DURATION_MIN_DAYS = PARAMETER_BOUNDS.durationDays.min;
const UNUSUAL_DURATION_MAX_DAYS = PARAMETER_BOUNDS.durationDays.max;
const UNUSUAL_AMOUNT_MIN = PARAMETER_BOUNDS.amount.min;
const UNUSUAL_AMOUNT_MAX = PARAMETER_BOUNDS.amount.max;

function checkWarnings(data: ValidatedCommitmentDraft): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (data.maxLossBps > HIGH_RISK_THRESHOLD_BPS) {
    warnings.push({
      code: "HIGH_RISK_LOSS_TOLERANCE",
      message: `Max loss tolerance of ${data.maxLossBps} bps is high (>${HIGH_RISK_THRESHOLD_BPS} bps). Consider reducing risk exposure.`,
      field: "maxLossBps",
    });
  }

  if (
    data.durationDays < UNUSUAL_DURATION_MIN_DAYS ||
    data.durationDays > UNUSUAL_DURATION_MAX_DAYS
  ) {
    warnings.push({
      code: "UNUSUAL_DURATION",
      message: `Duration of ${data.durationDays} days is unusual. Consider a duration between ${UNUSUAL_DURATION_MIN_DAYS} and ${UNUSUAL_DURATION_MAX_DAYS} days.`,
      field: "durationDays",
    });
  }

  if (
    data.amount < UNUSUAL_AMOUNT_MIN ||
    data.amount > UNUSUAL_AMOUNT_MAX
  ) {
    warnings.push({
      code: "UNUSUAL_AMOUNT",
      message: `Amount of ${data.amount} is outside typical range. Consider an amount between ${UNUSUAL_AMOUNT_MIN} and ${UNUSUAL_AMOUNT_MAX}.`,
      field: "amount",
    });
  }

  return warnings;
}

// ─── Address validation ───────────────────────────────────────────────────────

export type CreateCommitmentInput = z.infer<typeof createCommitmentSchema>;
export type CreateMarketplaceListingInput = z.infer<
  typeof createMarketplaceListingSchema
>;
// Validate Stellar address
export function validateAddress(address: string): string {
  try {
    return addressSchema2.parse(address);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.issues[0].message, "address");
    }
    throw error;
  }
}

/**
 * Validates a Stellar StrKey address (Ed25519 public key, G... format).
 *
 * @param address - The address string to validate
 * @param field   - Optional field name for error context (default: "address")
 * @returns The trimmed, validated address string
 * @throws {ValidationError} with field context if the address is invalid
 *
 * @example
 * validateStellarAddress("GABC..."); // returns the address
 * validateStellarAddress("invalid"); // throws ValidationError
 */
export function validateStellarAddress(
  address: unknown,
  field = "address",
): string {
  if (typeof address !== "string" || address.trim() === "") {
    throw new ValidationError(
      `${field} is required and must be a non-empty string.`,
      field,
    );
  }
  const trimmed = address.trim();
  if (!StrKey.isValidEd25519PublicKey(trimmed)) {
    throw new ValidationError(
      `${field} must be a valid Stellar address (G... format).`,
      field,
    );
  }
  return trimmed;
}

/**
 * Validates that an asset code is in the supported allowlist.
 *
 * @param assetCode - The asset code to validate (e.g., "XLM", "USDC")
 * @param field     - Optional field name for error context (default: "asset")
 * @returns The validated asset code
 * @throws {ValidationError} if the asset is not supported
 *
 * @example
 * validateSupportedAsset("XLM"); // returns "XLM"
 * validateSupportedAsset("INVALID"); // throws ValidationError
 */
export function validateSupportedAsset(
  assetCode: unknown,
  field = "asset",
): string {
  if (typeof assetCode !== "string" || assetCode.trim() === "") {
    throw new ValidationError(
      `${field} is required and must be a non-empty string.`,
      field,
    );
  }

  const trimmed = assetCode.trim().toUpperCase();
  const supported = SUPPORTED_ASSETS.map((a) => a.code);

  if (!supported.includes(trimmed)) {
    throw new ValidationError(
      `${field} "${trimmed}" is not supported. Supported assets: ${supported.join(", ")}.`,
      field,
    );
  }

  return trimmed;
}

/**
 * Zod schema refinement for Stellar addresses.
 * Use this inside any Zod schema that accepts a Stellar address field.
 *
 * @example
 * z.object({ ownerAddress: stellarAddressSchema })
 */
export { addressSchema, addressSchema as stellarAddressSchema };

// Amount schema: accept number or numeric string and coerce to number
const amountSchema3 = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (typeof n !== 'number' || Number.isNaN(n)) throw new z.ZodError([]);
  return n;
}).refine((n) => n > 0, { message: 'Amount must be a positive number' });

// Simple pagination schema
const paginationSchema3 = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).optional(),
});

// Validate amount (positive number, can be string or number)
export function validateAmount(amount: string | number): number {
  try {
    return amountSchema3.parse(amount);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.issues[0].message, "amount");
    }
    throw error;
  }
}

// Validate pagination parameters
export function validatePagination(
  page?: string | number,
  limit?: string | number,
): PaginationParams {
  try {
    const parsedPage = page === undefined ? 1 : Number(page);
    const parsedLimit = limit === undefined ? 10 : Number(limit);

    if (!Number.isInteger(parsedPage) || parsedPage <= 0) {
      throw new ValidationError("page must be a positive integer", "page");
    }
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
      throw new ValidationError("limit must be a positive integer no greater than 100", "limit");
    }

    return {
      page: parsedPage,
      pageSize: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit,
    };
  } catch (error) {
    throw error;
  }
}

// Validate filters (generic, for now just check types)
export function validateFilters(
  filters: Record<string, unknown>,
): FilterParams {
  const validated: FilterParams = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      validated[key] = value;
    } else {
      throw new ValidationError(
        `Filter ${key} must be a string, number, or boolean`,
        key,
      );
    }
  }
  return validated;
}

// Helper to handle validation in API routes
export function handleValidationError(error: unknown) {
  if (error instanceof ValidationError) {
    return Response.json(
      { error: error.message, field: error.field },
      { status: 400 },
    );
  }
  if (error instanceof z.ZodError) {
    const firstError = error.issues[0];
    const field = firstError.path.join(".");
    return Response.json({ error: firstError.message, field }, { status: 400 });
  }
  throw error; // Re-throw if not validation error
}
