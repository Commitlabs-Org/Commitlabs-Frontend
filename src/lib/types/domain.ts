/**
 * Shared domain types for commitments, attestations, health metrics, and listings.
 * Used across backend API and frontend.
 */

export type CommitmentType = 'Safe' | 'Balanced' | 'Aggressive';

export type CommitmentStatus = 'Active' | 'Settled' | 'Violated' | 'Early Exit';

export interface Commitment {
  id: string;
  type: CommitmentType;
  status: CommitmentStatus;
  asset: string;
  amount: string;
  currentValue?: string;
  changePercent?: number;
  durationProgress?: number;
  daysRemaining?: number;
  complianceScore?: number;
  maxLoss?: string;
  currentDrawdown?: string;
  createdDate?: string;
  expiryDate?: string;
  createdAt?: string;
  expiresAt?: string;
}

export interface CommitmentStats {
  totalActive: number;
  totalCommittedValue: string;
  avgComplianceScore: number;
  totalFeesGenerated: string;
}

export const ATTESTATION_TYPES = [
  'health_check',
  'violation',
  'fee_generation',
  'drawdown',
] as const;

export type AttestationType = (typeof ATTESTATION_TYPES)[number];

export type AttestationVerdict = 'pass' | 'fail' | 'unknown';

export type AttestationSeverity = 'ok' | 'warning' | 'violation';

export interface Attestation {
  id: string;
  commitmentId: string;
  kind?: string;
  verdict?: AttestationVerdict;
  observedAt: string;
  title?: string;
  description?: string;
  txHash?: string;
  severity?: AttestationSeverity;
  details?: Record<string, unknown>;
}

export interface HealthMetrics {
  status: string;
  uptime: number;
  mock_requests_total?: number;
  mock_errors_total?: number;
  timestamp: string;
}

export type ListingStatus = 'Active' | 'Sold' | 'Cancelled';

export interface MarketplaceListing {
  id: string;
  commitmentId: string;
  price: string;
  currencyAsset: string;
  sellerAddress: string;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateListingRequest {
  commitmentId: string;
  price: string;
  currencyAsset: string;
  sellerAddress: string;
}
