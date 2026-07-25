import { ProtocolConstantsResponseSchema } from '@/lib/schemas/apiContracts';

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

export async function fetchProtocolConstants(): Promise<ProtocolConstants> {
  const response = await fetch('/api/protocol/constants');

  if (!response.ok) {
    throw new Error(`Failed to fetch protocol constants: ${response.statusText}`);
  }

  const json = await response.json();
  const parsed = ProtocolConstantsResponseSchema.safeParse(json);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Failed to validate protocol constants response payload: ${issues}`);
  }

  return parsed.data.data;
}

export function getEarlyExitGracePeriodDays(
  constants: ProtocolConstants | null | undefined,
): number {
  const value = constants?.commitmentLimits.earlyExitGracePeriodDays;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}
