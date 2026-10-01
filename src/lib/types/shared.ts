/**
 * Shared enums and types used across domain and DTO layers.
 * These provide a single source of truth for common values.
 */

/**
 * Canonical commitment status values.
 * Used as the single source of truth across the application.
 *
 * Mapping to other representations:
 * - Domain (legacy): 'Active' -> 'active', 'Settled' -> 'settled', 'Violated' -> 'violated', 'Early Exit' -> 'early_exit'
 * - DTO (API): lowercase snake_case matches this enum
 */
export enum CommitmentStatus {
  ACTIVE = 'active',
  SETTLED = 'settled',
  VIOLATED = 'violated',
  EARLY_EXIT = 'early_exit',
}

/**
 * Canonical commitment type values.
 * Used as the single source of truth across the application.
 *
 * Mapping to other representations:
 * - Domain (legacy): Title Case -> lowercase snake_case
 * - DTO (API): lowercase snake_case matches this enum
 */
export enum CommitmentType {
  SAFE = 'safe',
  BALANCED = 'balanced',
  AGGRESSIVE = 'aggressive',
}

/**
 * Type alias for the enum values to maintain backward compatibility
 */
export type CommitmentStatusType = CommitmentStatus;
export type CommitmentTypeType = CommitmentType;

/**
 * Mapping functions for legacy domain representation (Title Case with spaces)
 */
export const DOMAIN_STATUS_MAPPING: Record<string, CommitmentStatus> = {
  Active: CommitmentStatus.ACTIVE,
  Settled: CommitmentStatus.SETTLED,
  Violated: CommitmentStatus.VIOLATED,
  'Early Exit': CommitmentStatus.EARLY_EXIT,
};

export const DOMAIN_TYPE_MAPPING: Record<string, CommitmentType> = {
  Safe: CommitmentType.SAFE,
  Balanced: CommitmentType.BALANCED,
  Aggressive: CommitmentType.AGGRESSIVE,
};

/**
 * Reverse mapping for converting canonical to legacy domain format
 */
export const CANONICAL_TO_DOMAIN_STATUS: Record<CommitmentStatus, string> = {
  [CommitmentStatus.ACTIVE]: 'Active',
  [CommitmentStatus.SETTLED]: 'Settled',
  [CommitmentStatus.VIOLATED]: 'Violated',
  [CommitmentStatus.EARLY_EXIT]: 'Early Exit',
};

export const CANONICAL_TO_DOMAIN_TYPE: Record<CommitmentType, string> = {
  [CommitmentType.SAFE]: 'Safe',
  [CommitmentType.BALANCED]: 'Balanced',
  [CommitmentType.AGGRESSIVE]: 'Aggressive',
};
