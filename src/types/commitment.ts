/**
 * Re-exports canonical Commitment types from the single source of truth in
 * `@/lib/types/domain`.  Import from this module in UI-layer files that
 * previously depended on the now-removed standalone definitions.
 */
export type {
  CommitmentType,
  CommitmentStatus,
  Commitment,
  CommitmentStats,
  TrendDirection,
  StatTrend,
} from '@/lib/types/domain';
