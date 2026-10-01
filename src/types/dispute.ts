/**
 * Represents the current state of a dispute for a commitment.
 * Used by DisputeStatusTracker to render the dispute flow stepper.
 */
export interface DisputeInfo {
  /** The current stage of the dispute process */
  stage: 'filed' | 'under_review' | 'escalated' | 'resolved' | 'dismissed';
  /** ISO-8601 timestamp when the dispute was formally filed */
  filedAt: string;
  /** Human-readable category for the reason the dispute was opened */
  reasonCategory: string;
  /** ISO-8601 timestamp when review was initiated, if available */
  reviewStartedAt?: string;
  /** ISO-8601 timestamp when the dispute was resolved, if applicable */
  resolvedAt?: string;
  /** Summary of the resolution outcome, if applicable */
  resolution?: string;
}

/**
 * Connection state of the SSE stream that live-updates the dispute status.
 */
export type SSEConnectionState = 'connecting' | 'live' | 'reconnecting';
