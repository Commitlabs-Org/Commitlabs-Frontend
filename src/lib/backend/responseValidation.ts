/**
 * @file responseValidation.ts
 *
 * Production-grade response validation boundaries for sensitive data streams.
 * Ensures that responses from services conform to expected structure and bounds
 * before being exposed to users or committed to caches.
 *
 * Invariants
 * ──────────
 * • All array responses must be sized and individual items validated.
 * • All numeric fields must be parseable and within reasonable bounds.
 * • All string fields must be non-empty (for required fields) and bounded in length.
 * • All date fields must parse as ISO 8601 or be rejected.
 * • Missing or extra fields cause validation to fail hard (not coerced).
 * • On validation failure, errors are safe for client consumption (no internal details).
 */

import { BadRequestError, InternalError } from './errors';
import type { ChainCommitment } from './services/contracts';

/**
 * Bounds for individual field values. These prevent resource exhaustion and
 * ensure data consistency.
 */
export const FIELD_BOUNDS = {
  // Commitment ID: alphanumeric + hyphens, typical 20-100 chars
  COMMITMENT_ID_LENGTH: { min: 1, max: 200 },
  // Stellar addresses are always 56 characters
  ADDRESS_LENGTH: { min: 56, max: 56 },
  // Asset symbols typically 1-12 chars (USDC, STELLARCOIN, etc)
  ASSET_LENGTH: { min: 1, max: 12 },
  // Numeric amounts as strings can be up to ~76 digits (beyond safe integer)
  NUMERIC_STRING_LENGTH: { min: 1, max: 100 },
  // Status enum strings are typically 10-20 chars
  STATUS_LENGTH: { min: 1, max: 50 },
  // Compliance score 0-100
  COMPLIANCE_SCORE: { min: 0, max: 100 },
  // Violation count typically 0-1000
  VIOLATION_COUNT: { min: 0, max: 10000 },
  // ISO 8601 date string (minimum 10 for YYYY-MM-DD, max 35 with tz info)
  DATE_STRING_LENGTH: { min: 10, max: 50 },
  // Contract version typically 1-20 chars
  CONTRACT_VERSION_LENGTH: { min: 1, max: 50 },
} as const;

export const VALID_COMMITMENT_STATUSES = [
  'ACTIVE',
  'COMPLETED',
  'DISPUTED',
  'EXPIRED',
  'CANCELLED',
  'SETTLED',
] as const;

export type ValidCommitmentStatus = (typeof VALID_COMMITMENT_STATUSES)[number];

/**
 * Validates that a value is a string of reasonable length.
 */
function validateStringField(
  value: unknown,
  fieldName: string,
  bounds: { min: number; max: number },
): string {
  if (typeof value !== 'string') {
    throw new BadRequestError(
      `Commitment field "${fieldName}" must be a string, got ${typeof value}`,
    );
  }

  const trimmed = value.trim();
  if (trimmed.length < bounds.min || trimmed.length > bounds.max) {
    throw new BadRequestError(
      `Commitment field "${fieldName}" length out of bounds [${bounds.min}, ${bounds.max}]`,
    );
  }

  return trimmed;
}

/**
 * Validates that a value is a number within bounds.
 */
function validateNumberField(
  value: unknown,
  fieldName: string,
  bounds: { min: number; max: number },
): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new BadRequestError(
      `Commitment field "${fieldName}" must be a finite number, got ${typeof value}`,
    );
  }

  if (value < bounds.min || value > bounds.max) {
    throw new BadRequestError(
      `Commitment field "${fieldName}" value out of bounds [${bounds.min}, ${bounds.max}]`,
    );
  }

  return value;
}

/**
 * Validates that a numeric string (bigint representation) is within bounds.
 * Does not parse the value as a JavaScript number (to avoid precision loss).
 */
function validateNumericStringField(
  value: unknown,
  fieldName: string,
  bounds: { min: number; max: number },
): string {
  const str = validateStringField(value, fieldName, bounds);

  // Ensure it looks like a number: optional minus sign, then digits only
  if (!/^-?\d+$/.test(str)) {
    throw new BadRequestError(
      `Commitment field "${fieldName}" must be a numeric string, got "${str}"`,
    );
  }

  return str;
}

/**
 * Validates that a date field is a valid ISO 8601 string.
 * Does not attempt to parse to Date; just validates the string format.
 */
function validateDateField(value: unknown, fieldName: string): string {
  const str = validateStringField(value, fieldName, FIELD_BOUNDS.DATE_STRING_LENGTH);

  // Try to parse as ISO 8601; if it fails, reject
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(
      `Commitment field "${fieldName}" must be a valid ISO 8601 date, got "${str}"`,
    );
  }

  return str;
}

/**
 * Validates that a status value is one of the known commitment statuses.
 */
function validateStatusField(value: unknown, fieldName: string): ValidCommitmentStatus {
  const str = validateStringField(value, fieldName, FIELD_BOUNDS.STATUS_LENGTH);

  if (!VALID_COMMITMENT_STATUSES.includes(str as ValidCommitmentStatus)) {
    throw new BadRequestError(
      `Commitment field "${fieldName}" has unknown status "${str}", expected one of ${VALID_COMMITMENT_STATUSES.join(', ')}`,
    );
  }

  return str as ValidCommitmentStatus;
}

/**
 * Validates a single commitment object returned from the chain service.
 * Enforces all required fields and checks optional fields if present.
 * Throws BadRequestError if validation fails (user-safe error messages).
 * Throws InternalError if the structure is so malformed that it suggests
 * a service bug (e.g., required field completely missing).
 */
export function validateChainCommitment(
  commitment: unknown,
  index?: number,
): ChainCommitment {
  if (!commitment || typeof commitment !== 'object') {
    const msg = index !== undefined ? `Commitment at index ${index}` : 'Commitment';
    throw new InternalError(`${msg} is not an object: ${typeof commitment}`);
  }

  const obj = commitment as Record<string, unknown>;

  // Validate all required fields in order
  const id = validateStringField(obj.id, 'id', FIELD_BOUNDS.COMMITMENT_ID_LENGTH);
  const ownerAddress = validateStringField(obj.ownerAddress, 'ownerAddress', FIELD_BOUNDS.ADDRESS_LENGTH);
  const asset = validateStringField(obj.asset, 'asset', FIELD_BOUNDS.ASSET_LENGTH);
  const amount = validateNumericStringField(obj.amount, 'amount', FIELD_BOUNDS.NUMERIC_STRING_LENGTH);
  const status = validateStatusField(obj.status, 'status');
  const complianceScore = validateNumberField(obj.complianceScore, 'complianceScore', FIELD_BOUNDS.COMPLIANCE_SCORE);
  const currentValue = validateNumericStringField(obj.currentValue, 'currentValue', FIELD_BOUNDS.NUMERIC_STRING_LENGTH);
  const feeEarned = validateNumericStringField(obj.feeEarned, 'feeEarned', FIELD_BOUNDS.NUMERIC_STRING_LENGTH);
  const violationCount = validateNumberField(obj.violationCount, 'violationCount', FIELD_BOUNDS.VIOLATION_COUNT);

  // Validate optional fields if present
  let createdAt: string | undefined;
  if (obj.createdAt !== undefined) {
    createdAt = validateDateField(obj.createdAt, 'createdAt');
  }

  let expiresAt: string | undefined;
  if (obj.expiresAt !== undefined) {
    expiresAt = validateDateField(obj.expiresAt, 'expiresAt');
  }

  let contractVersion: string | undefined;
  if (obj.contractVersion !== undefined) {
    contractVersion = validateStringField(obj.contractVersion, 'contractVersion', FIELD_BOUNDS.CONTRACT_VERSION_LENGTH);
  }

  // Ensure no extra fields that we don't know about (defense in depth)
  const knownFields = new Set([
    'id',
    'ownerAddress',
    'asset',
    'amount',
    'status',
    'complianceScore',
    'currentValue',
    'feeEarned',
    'violationCount',
    'createdAt',
    'expiresAt',
    'contractVersion',
  ]);
  const extraFields = Object.keys(obj).filter((k) => !knownFields.has(k));
  if (extraFields.length > 0) {
    throw new InternalError(
      `Commitment has unexpected fields: ${extraFields.join(', ')}. This suggests a service contract change.`,
    );
  }

  return {
    id,
    ownerAddress,
    asset,
    amount,
    status,
    complianceScore,
    currentValue,
    feeEarned,
    violationCount,
    createdAt,
    expiresAt,
    contractVersion,
  };
}

/**
 * Validates an array of commitments returned from the chain service.
 * Each commitment is validated individually. Returns early on first failure.
 * Throws if the array itself is malformed or too large.
 */
export function validateCommitmentArray(
  commitments: unknown,
  maxLength: number,
): ChainCommitment[] {
  if (!Array.isArray(commitments)) {
    throw new InternalError(`Expected commitments to be an array, got ${typeof commitments}`);
  }

  if (commitments.length > maxLength) {
    throw new InternalError(
      `Commitment array exceeds max length ${maxLength}: received ${commitments.length}`,
    );
  }

  return commitments.map((c, i) => validateChainCommitment(c, i));
}
