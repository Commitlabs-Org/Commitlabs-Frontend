/**
 * Dispute metadata shared by the UI. Kept free of `@stellar/stellar-sdk` so
 * dashboard components can render dispute state without pulling the Soroban SDK
 * into their first-load bundle (see performance-budgets.json). The on-chain
 * calls live in `escrow.ts`.
 */

/** Client-side bound for the reason string. The contract accepts it unbounded. */
export const MAX_DISPUTE_REASON = 1000;

/** Mirrors the contract's `DisputeReason` enum. The on-chain categorizer is a
 * stub that always returns `Other`, so the frontend treats the category as
 * advisory metadata only. */
export enum DisputeCategory {
  ValueMismatch = 0,
  NonCompliance = 1,
  FraudSuspicion = 2,
  OperationalFailure = 3,
  Other = 4,
}

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  [DisputeCategory.ValueMismatch]: 'Value mismatch',
  [DisputeCategory.NonCompliance]: 'Compliance violation',
  [DisputeCategory.FraudSuspicion]: 'Suspected fraud',
  [DisputeCategory.OperationalFailure]: 'Operational failure',
  [DisputeCategory.Other]: 'Other',
};

export interface DisputeRecord {
  reasonCategory: DisputeCategory;
  reasonText: string;
  disputedAt: Date;
  disputedBy: string;
}
