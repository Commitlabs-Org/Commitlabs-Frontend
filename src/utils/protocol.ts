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
  return response.json();
}
