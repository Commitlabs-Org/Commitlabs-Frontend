/**
 * @/types/commitment
 *
 * Public re-export barrel for commitment domain types.
 *
 * Components and hooks throughout the application import from this path.
 * The canonical type definitions live in `src/lib/types/domain.ts` so that
 * backend utilities can share the same type without depending on
 * `src/types/` (which is treated as a frontend-facing module).
 */

export type {
  Commitment,
  CommitmentType,
  CommitmentStatus,
  CommitmentStats,
  Attestation,
  AttestationType,
  AttestationVerdict,
  AttestationSeverity,
  HealthMetrics,
  MarketplaceListing,
  CreateListingRequest,
  HistoryEvent,
  HistoryEventKind,
  CreatedEvent,
  AttestationEvent,
  EarlyExitEvent,
  SettlementEvent,
  Notification,
  NotificationSeverity,
  NotificationType,
  TrendDirection,
  StatTrend,
  ListingStatus,
} from '@/lib/types/domain';

// Re-export chain-status values so consumers can reference on-chain status
// strings without importing from the backend services module directly.
export type { ChainCommitmentStatus } from '@/lib/backend/services/contracts';
