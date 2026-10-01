/**
 * src/types/commitment.ts
 *
 * Public-facing commitment types used across the frontend.
 * Mirrors the domain shapes in src/lib/types/domain.ts but exposes a
 * stable, UI-oriented interface that isn't tied to the backend internals.
 */

/** On-chain lifecycle states. */
export type CommitmentStatus = 'Active' | 'Settled' | 'Violated' | 'Early Exit';

/** Risk profile. */
export type CommitmentType = 'Safe' | 'Balanced' | 'Aggressive';

/** UI-facing commitment shape used by MyCommitmentsGrid and related views. */
export interface Commitment {
  id: string;
  type: CommitmentType;
  status: CommitmentStatus;
  ownerAddress?: string;
  asset: string;
  amount: string;
  currentValue?: string;
  changePercent?: number;
  durationProgress?: number;
  daysRemaining?: number;
  complianceScore?: number;
  maxLoss?: string;
  currentDrawdown?: string;
  /** ISO-8601 date string (legacy field). */
  createdDate?: string;
  /** ISO-8601 date string (legacy field). */
  expiryDate?: string;
  /** ISO-8601 date string. */
  createdAt?: string;
  /** ISO-8601 date string. */
  expiresAt?: string;
}
