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

// ---------------------------------------------------------------------------
// Commitment history / timeline
// ---------------------------------------------------------------------------

/**
 * Discriminated union of all lifecycle event kinds that can appear in a
 * commitment's history timeline.
 *
 * | kind          | trigger                                      |
 * |---------------|----------------------------------------------|
 * | created       | Commitment first recorded on-chain           |
 * | attestation   | Any attestation recorded against it          |
 * | early_exit    | Owner triggered an early exit                |
 * | settlement    | Commitment reached maturity and was settled  |
 */
export type HistoryEventKind =
  | 'created'
  | 'attestation'
  | 'early_exit'
  | 'settlement';

export interface BaseHistoryEvent {
  /** Stable, deterministic identifier for this event (kind + source id). */
  eventId: string;
  kind: HistoryEventKind;
  /** ISO-8601 timestamp used for chronological ordering. */
  occurredAt: string;
  /** Optional on-chain transaction reference. */
  txHash?: string;
}

export interface CreatedEvent extends BaseHistoryEvent {
  kind: 'created';
  payload: {
    asset: string;
    amount: string;
    expiresAt?: string;
  };
}

export interface AttestationEvent extends BaseHistoryEvent {
  kind: 'attestation';
  payload: {
    attestationId: string;
    attestationType: string;
    complianceScore?: number;
    violation?: boolean;
    severity?: string;
  };
}

export interface EarlyExitEvent extends BaseHistoryEvent {
  kind: 'early_exit';
  payload: {
    penaltyAmount?: string;
    exitedBy?: string;
  };
}

export interface SettlementEvent extends BaseHistoryEvent {
  kind: 'settlement';
  payload: {
    settlementAmount?: string;
    finalStatus?: string;
  };
}

export type HistoryEvent =
  | CreatedEvent
  | AttestationEvent
  | EarlyExitEvent
  | SettlementEvent;
