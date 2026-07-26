/**
 * Allowlisted Zod schemas for attestation `data` payloads, keyed by attestationType.
 *
 * Rules enforced here:
 *  - Only explicitly listed keys are accepted (`.strict()` strips nothing — it rejects).
 *  - Each field has a type constraint and, where applicable, a range limit.
 *  - String fields are capped at MAX_STRING_LENGTH characters.
 *  - The total serialised payload may not exceed MAX_PAYLOAD_BYTES bytes.
 *
 * Adding a new attestation type:
 *  1. Add the type to ATTESTATION_TYPES in src/lib/types/domain.ts.
 *  2. Add a corresponding Zod schema below.
 *  3. Document the allowed fields in the JSDoc block for that schema.
 *  4. Add tests in tests/api/attestationSchemas.test.ts.
 */

import { z } from "zod";
import type { AttestationType } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Shared limits
// ---------------------------------------------------------------------------

/** Maximum length for any single string field inside `data`. */
export const MAX_STRING_LENGTH = 256;

/** Maximum serialised byte size of the entire `data` object. */
export const MAX_PAYLOAD_BYTES = 2048;

// ---------------------------------------------------------------------------
// Reusable field primitives
// ---------------------------------------------------------------------------

const boundedString = z.string().max(MAX_STRING_LENGTH);

const complianceScoreField = z
  .number({ invalid_type_error: "complianceScore must be a number" })
  .min(0, "complianceScore must be >= 0")
  .max(100, "complianceScore must be <= 100");

const violationField = z.boolean({
  invalid_type_error: "violation must be a boolean",
});

const feeAmountField = z
  .union([z.string().max(MAX_STRING_LENGTH), z.number().nonnegative()])
  .transform((v) => String(v));

// ---------------------------------------------------------------------------
// Per-type schemas  (all use .strict() to reject unknown keys)
// ---------------------------------------------------------------------------

/**
 * health_check — periodic compliance snapshot.
 *
 * Allowed fields:
 *  - complianceScore  (required) number 0–100
 *  - violation        (optional) boolean — true if a rule was breached
 *  - notes            (optional) string ≤ 256 chars
 */
export const healthCheckDataSchema = z
  .object({
    complianceScore: complianceScoreField,
    violation: violationField.optional().default(false),
    notes: boundedString.optional(),
  })
  .strict();

/**
 * violation — explicit rule-breach record.
 *
 * Allowed fields:
 *  - reason           (required) string ≤ 256 chars — human-readable cause
 *  - complianceScore  (optional) number 0–100 — score at time of violation
 *  - severity         (optional) "low" | "medium" | "high"
 */
export const violationDataSchema = z
  .object({
    reason: boundedString.min(1, "reason is required for violation attestations"),
    complianceScore: complianceScoreField.optional(),
    severity: z.enum(["low", "medium", "high"]).optional(),
  })
  .strict();

/**
 * fee_generation — fee accrual event.
 *
 * Allowed fields:
 *  - feeEarned        (required) string or non-negative number — amount earned
 *  - asset            (optional) string ≤ 256 chars — asset ticker (e.g. "XLM")
 *  - complianceScore  (optional) number 0–100
 */
export const feeGenerationDataSchema = z
  .object({
    feeEarned: feeAmountField,
    asset: boundedString.optional(),
    complianceScore: complianceScoreField.optional(),
  })
  .strict();

/**
 * drawdown — drawdown measurement event.
 *
 * Allowed fields:
 *  - drawdownPercent  (required) number 0–100 — current drawdown as a percentage
 *  - maxAllowed       (optional) number 0–100 — configured max-loss threshold
 *  - complianceScore  (optional) number 0–100
 */
export const drawdownDataSchema = z
  .object({
    drawdownPercent: z
      .number({ invalid_type_error: "drawdownPercent must be a number" })
      .min(0, "drawdownPercent must be >= 0")
      .max(100, "drawdownPercent must be <= 100"),
    maxAllowed: z
      .number()
      .min(0)
      .max(100)
      .optional(),
    complianceScore: complianceScoreField.optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ATTESTATION_DATA_SCHEMAS = {
  health_check: healthCheckDataSchema,
  violation: violationDataSchema,
  fee_generation: feeGenerationDataSchema,
  drawdown: drawdownDataSchema,
} as const satisfies Record<AttestationType, z.ZodTypeAny>;

// ---------------------------------------------------------------------------
// Validated output types
// ---------------------------------------------------------------------------

export type HealthCheckData = z.infer<typeof healthCheckDataSchema>;
export type ViolationData = z.infer<typeof violationDataSchema>;
export type FeeGenerationData = z.infer<typeof feeGenerationDataSchema>;
export type DrawdownData = z.infer<typeof drawdownDataSchema>;

export type AttestationData =
  | HealthCheckData
  | ViolationData
  | FeeGenerationData
  | DrawdownData;

// ---------------------------------------------------------------------------
// Validation entry-point
// ---------------------------------------------------------------------------

/**
 * Validates and normalises an attestation `data` payload for the given type.
 *
 * Enforces:
 *  1. Payload byte-size limit (MAX_PAYLOAD_BYTES).
 *  2. Per-type allowlist via the corresponding Zod schema (unknown keys rejected).
 *  3. Field-level type and range constraints.
 *
 * @param attestationType - One of the known AttestationType values.
 * @param data            - Raw `data` object from the request body.
 * @returns Parsed and normalised data object.
 * @throws `z.ZodError` if validation fails.
 * @throws `Error` with code `PAYLOAD_TOO_LARGE` if the payload exceeds the size limit.
 */
export function validateAttestationData(
  attestationType: AttestationType,
  data: unknown,
): AttestationData {
  // Size guard — check before parsing to avoid processing huge payloads
  const serialised = JSON.stringify(data ?? {});
  if (Buffer.byteLength(serialised, "utf8") > MAX_PAYLOAD_BYTES) {
    const err = new Error(
      `Attestation data payload exceeds the maximum allowed size of ${MAX_PAYLOAD_BYTES} bytes.`,
    );
    (err as NodeJS.ErrnoException).code = "PAYLOAD_TOO_LARGE";
    throw err;
  }

  const schema = ATTESTATION_DATA_SCHEMAS[attestationType];
  return schema.parse(data) as AttestationData;
}
