import {
  ProtocolConstantsResponseSchema,
  ProtocolConstantsSchema,
} from '@/lib/schemas/apiContracts';

export interface PenaltyTier {
  type: string;
  earlyExitPenaltyPercent: number;
  description: string;
}

export interface FeeConstants {
  networkBaseFeeStroops: number;
  platformFeePercent: number;
}

export interface CommitmentLimits {
  minAmountXlm: number;
  maxAmountXlm: number;
  minDurationDays: number;
  maxDurationDays: number;
  maxLossPercentCeiling: number;
  earlyExitGracePeriodDays: number;
}

export interface ProtocolConstants {
  protocolVersion: string;
  network: string;
  fees: FeeConstants;
  penalties: PenaltyTier[];
  commitmentLimits: CommitmentLimits;
  cachedAt: string;
}

export { ProtocolConstantsSchema, ProtocolConstantsResponseSchema };

/**
 * Fetches and validates protocol constants from the API endpoint.
 *
 * @param endpoint Optional custom endpoint URL for protocol constants.
 * @returns Validated protocol constants domain object.
 * @throws Error when HTTP request is not OK or response body fails schema validation.
 */
export async function fetchProtocolConstants(
  endpoint = '/api/protocol/constants',
): Promise<ProtocolConstants> {
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`Failed to fetch protocol constants: ${response.statusText}`);
  }

  const json: unknown = await response.json();

  const envelopedParsed = ProtocolConstantsResponseSchema.safeParse(json);
  if (envelopedParsed.success) {
    return envelopedParsed.data.data;
  }

  const directParsed = ProtocolConstantsSchema.safeParse(json);
  if (directParsed.success) {
    return directParsed.data;
  }

  const isEnvelopedShape =
    typeof json === 'object' && json !== null && 'data' in json && 'success' in json;

  const relevantError = isEnvelopedShape ? envelopedParsed.error : directParsed.error;

  const issues = relevantError?.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');

  throw new Error(`Failed to validate protocol constants response payload: ${issues}`);
}

/**
 * Extracts and normalizes the early exit grace period duration in days.
 *
 * @param constants Protocol constants object or null/undefined if unavailable.
 * @returns Non-negative integer representing the grace period days, defaulting to 0.
 */
export function getEarlyExitGracePeriodDays(
  constants: ProtocolConstants | null | undefined,
): number {
  const value = constants?.commitmentLimits?.earlyExitGracePeriodDays;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}
