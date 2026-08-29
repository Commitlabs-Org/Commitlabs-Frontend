/**
 * Transaction state machine with explicit invariants and validation.
 * Enforces state transitions, bounds, and operational guarantees.
 */

import type {
  TransactionState,
  TransactionMetadata,
  TransitionValidationResult,
  TransactionError,
  TransactionErrorType,
} from './transactionTypes';
import {
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  RECOVERABLE_STATES,
  TRANSACTION_BOUNDS,
  TransactionErrorType,
} from './transactionTypes';

/**
 * Transaction state machine class
 * Enforces invariants and provides safe state transitions
 */
export class TransactionStateMachine {
  private state: TransactionState;
  private retryCount: number;
  private readonly createdAt: string;
  private updatedAt: string;

  constructor(initialState: TransactionState = 'idle') {
    this.state = initialState;
    this.retryCount = 0;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
  }

  /**
   * Get current state
   */
  getState(): TransactionState {
    return this.state;
  }

  /**
   * Get retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Get creation timestamp
   */
  getCreatedAt(): string {
    return this.createdAt;
  }

  /**
   * Get last updated timestamp
   */
  getUpdatedAt(): string {
    return this.updatedAt;
  }

  /**
   * Validate state transition
   */
  validateTransition(newState: TransactionState): TransitionValidationResult {
    // Invariant: Cannot transition to same state
    if (newState === this.state) {
      return {
        valid: false,
        reason: `Cannot transition from ${this.state} to itself`,
      };
    }

    // Invariant: Check if transition is allowed
    const allowedTransitions = VALID_TRANSITIONS[this.state];
    if (!allowedTransitions.includes(newState)) {
      return {
        valid: false,
        reason: `Invalid transition from ${this.state} to ${newState}. Allowed: ${allowedTransitions.join(', ')}`,
      };
    }

    // Invariant: Terminal states cannot transition
    if (TERMINAL_STATES.includes(this.state)) {
      return {
        valid: false,
        reason: `Cannot transition from terminal state ${this.state}`,
      };
    }

    // Invariant: Check retry bounds
    if (newState === 'pending' && this.state !== 'idle') {
      if (this.retryCount >= TRANSACTION_BOUNDS.MAX_RETRY_ATTEMPTS) {
        return {
          valid: false,
          reason: `Max retry attempts (${TRANSACTION_BOUNDS.MAX_RETRY_ATTEMPTS}) exceeded`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Perform state transition with validation
   */
  transition(newState: TransactionState): TransactionError | null {
    const validation = this.validateTransition(newState);
    if (!validation.valid) {
      return {
        type: TransactionErrorType.INVALID_STATE_TRANSITION,
        message: validation.reason || 'Invalid state transition',
      };
    }

    // Increment retry count for recoverable states transitioning back to pending
    if (RECOVERABLE_STATES.includes(this.state) && newState === 'pending') {
      this.retryCount++;
    }

    this.state = newState;
    this.updatedAt = new Date().toISOString();
    return null;
  }

  /**
   * Check if state is terminal
   */
  isTerminal(): boolean {
    return TERMINAL_STATES.includes(this.state);
  }

  /**
   * Check if state is recoverable
   */
  isRecoverable(): boolean {
    return RECOVERABLE_STATES.includes(this.state);
  }

  /**
   * Check if retry is possible
   */
  canRetry(): boolean {
    return this.retryCount < TRANSACTION_BOUNDS.MAX_RETRY_ATTEMPTS && this.isRecoverable();
  }

  /**
   * Reset to idle state (for cleanup)
   */
  reset(): void {
    this.state = 'idle';
    this.retryCount = 0;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Create metadata snapshot
   */
  toMetadata(
    id: string,
    type: 'settlement' | 'early_exit',
    commitmentId: string,
    additionalFields: Partial<TransactionMetadata> = {},
  ): TransactionMetadata {
    return {
      id,
      type,
      commitmentId,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      retryCount: this.retryCount,
      ...additionalFields,
    };
  }
}

/**
 * Validate transaction metadata against invariants
 */
export function validateTransactionMetadata(
  metadata: TransactionMetadata,
): TransactionError | null {
  // Invariant: ID must be present
  if (!metadata.id || metadata.id.trim().length === 0) {
    return {
      type: TransactionErrorType.VALIDATION_ERROR,
      message: 'Transaction ID is required',
      transactionId: metadata.id,
    };
  }

  // Invariant: Commitment ID must be present
  if (!metadata.commitmentId || metadata.commitmentId.trim().length === 0) {
    return {
      type: TransactionErrorType.VALIDATION_ERROR,
      message: 'Commitment ID is required',
      transactionId: metadata.id,
    };
  }

  // Invariant: Retry count must not exceed bounds
  if (metadata.retryCount > TRANSACTION_BOUNDS.MAX_RETRY_ATTEMPTS) {
    return {
      type: TransactionErrorType.MAX_RETRIES_EXCEEDED,
      message: `Retry count ${metadata.retryCount} exceeds maximum ${TRANSACTION_BOUNDS.MAX_RETRY_ATTEMPTS}`,
      transactionId: metadata.id,
    };
  }

  // Invariant: Error message length must be bounded
  if (metadata.error && metadata.error.length > TRANSACTION_BOUNDS.MAX_ERROR_MESSAGE_LENGTH) {
    return {
      type: TransactionErrorType.VALIDATION_ERROR,
      message: `Error message exceeds maximum length of ${TRANSACTION_BOUNDS.MAX_ERROR_MESSAGE_LENGTH}`,
      transactionId: metadata.id,
    };
  }

  // Invariant: Timestamps must be valid ISO 8601
  try {
    new Date(metadata.createdAt);
    new Date(metadata.updatedAt);
  } catch {
    return {
      type: TransactionErrorType.VALIDATION_ERROR,
      message: 'Invalid timestamp format',
      transactionId: metadata.id,
    };
  }

  // Invariant: Updated timestamp must not be before created timestamp
  if (new Date(metadata.updatedAt) < new Date(metadata.createdAt)) {
    return {
      type: TransactionErrorType.VALIDATION_ERROR,
      message: 'Updated timestamp cannot be before created timestamp',
      transactionId: metadata.id,
    };
  }

  return null;
}

/**
 * Check if transaction is stale (exceeded TTL)
 */
export function isTransactionStale(metadata: TransactionMetadata): boolean {
  const now = Date.now();
  const updatedAt = new Date(metadata.updatedAt).getTime();
  const age = now - updatedAt;
  return age > TRANSACTION_BOUNDS.TRANSACTION_STATE_TTL_MS;
}

/**
 * Sanitize error message to prevent leaking sensitive information
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error.slice(0, TRANSACTION_BOUNDS.MAX_ERROR_MESSAGE_LENGTH);
  }
  if (error instanceof Error) {
    return error.message.slice(0, TRANSACTION_BOUNDS.MAX_ERROR_MESSAGE_LENGTH);
  }
  return 'An unknown error occurred';
}

/**
 * Create transaction error with proper structure
 */
export function createTransactionError(
  type: TransactionErrorType,
  message: string,
  transactionId?: string,
  originalError?: unknown,
): TransactionError {
  return {
    type,
    message: sanitizeErrorMessage(message),
    transactionId,
    originalError,
  };
}
