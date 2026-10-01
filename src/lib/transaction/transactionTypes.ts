/**
 * Transaction lifecycle types and constants for settlement and early-exit operations.
 * Defines explicit state machine, invariants, and operational bounds.
 */

/**
 * Transaction type identifiers
 */
export type TransactionType = 'settlement' | 'early_exit';

/**
 * Transaction states with explicit lifecycle
 */
export type TransactionState =
  | 'idle'           // No transaction in progress
  | 'pending'        // Transaction submitted, awaiting confirmation
  | 'confirming'     // Transaction confirmed on-chain, awaiting finalization
  | 'confirmed'      // Transaction fully confirmed and finalized
  | 'rejected'       // Transaction rejected by network or contract
  | 'reconciliation' // Transaction needs manual reconciliation
  | 'failed';        // Transaction failed due to error

/**
 * Valid state transitions for the transaction state machine
 */
export const VALID_TRANSITIONS: Record<TransactionState, TransactionState[]> = {
  idle: ['pending'],
  pending: ['confirming', 'rejected', 'failed'],
  confirming: ['confirmed', 'rejected', 'failed'],
  confirmed: [], // Terminal state
  rejected: ['reconciliation', 'idle'], // Can retry from rejected
  reconciliation: ['pending', 'idle'], // Can retry or abandon
  failed: ['idle'], // Can retry from failed
};

/**
 * Terminal states that cannot transition further
 */
export const TERMINAL_STATES: TransactionState[] = ['confirmed', 'failed'];

/**
 * Recoverable states that can transition back to pending
 */
export const RECOVERABLE_STATES: TransactionState[] = ['rejected', 'reconciliation'];

/**
 * Transaction metadata with explicit bounds
 */
export interface TransactionMetadata {
  /** Unique transaction identifier */
  id: string;
  /** Transaction type */
  type: TransactionType;
  /** Associated commitment ID */
  commitmentId: string;
  /** Current transaction state */
  state: TransactionState;
  /** Transaction hash from blockchain */
  txHash?: string;
  /** Caller wallet address */
  callerAddress?: string;
  /** Transaction timestamp (ISO 8601) */
  createdAt: string;
  /** Last updated timestamp (ISO 8601) */
  updatedAt: string;
  /** Error message if transaction failed */
  error?: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Transaction amount (for settlement) */
  settlementAmount?: string;
  /** Exit amount (for early exit) */
  exitAmount?: string;
  /** Penalty amount (for early exit) */
  penaltyAmount?: string;
  /** Reference ID for tracking */
  reference?: string;
}

/**
 * Operational bounds for transaction lifecycle
 */
export const TRANSACTION_BOUNDS = {
  /** Maximum number of retry attempts */
  MAX_RETRY_ATTEMPTS: 3,
  
  /** Maximum concurrent transactions per commitment */
  MAX_CONCURRENT_TRANSACTIONS: 1,
  
  /** Polling interval in milliseconds */
  POLLING_INTERVAL_MS: 2000,
  
  /** Maximum polling duration in milliseconds */
  MAX_POLLING_DURATION_MS: 60000, // 1 minute
  
  /** Maximum number of polling attempts */
  MAX_POLLING_ATTEMPTS: 30,
  
  /** Transaction state TTL in milliseconds (for cleanup) */
  TRANSACTION_STATE_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  
  /** Maximum transaction metadata size in bytes */
  MAX_METADATA_SIZE_BYTES: 4096,
  
  /** Maximum error message length */
  MAX_ERROR_MESSAGE_LENGTH: 500,
} as const;

/**
 * Telemetry event types for transaction monitoring
 */
export type TelemetryEventType =
  | 'transaction_started'
  | 'transaction_confirmed'
  | 'transaction_rejected'
  | 'transaction_failed'
  | 'polling_started'
  | 'polling_completed'
  | 'polling_failed'
  | 'retry_attempted'
  | 'state_transition';

/**
 * Telemetry data structure (sanitized, no secrets)
 */
export interface TelemetryEvent {
  /** Event type */
  type: TelemetryEventType;
  /** Transaction ID */
  transactionId: string;
  /** Transaction type */
  transactionType: TransactionType;
  /** Current state */
  state: TransactionState;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Event duration in milliseconds */
  durationMs?: number;
  /** Error code (if applicable) */
  errorCode?: string;
  /** Additional context (sanitized) */
  context?: Record<string, string | number | boolean>;
}

/**
 * Validation result for transaction state transitions
 */
export interface TransitionValidationResult {
  /** Whether transition is valid */
  valid: boolean;
  /** Reason if invalid */
  reason?: string;
}

/**
 * Polling configuration
 */
export interface PollingConfig {
  /** Interval between polls in milliseconds */
  intervalMs: number;
  /** Maximum total polling duration in milliseconds */
  maxDurationMs: number;
  /** Maximum number of polling attempts */
  maxAttempts: number;
  /** Whether polling is enabled */
  enabled: boolean;
}

/**
 * Default polling configuration
 */
export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  intervalMs: TRANSACTION_BOUNDS.POLLING_INTERVAL_MS,
  maxDurationMs: TRANSACTION_BOUNDS.MAX_POLLING_DURATION_MS,
  maxAttempts: TRANSACTION_BOUNDS.MAX_POLLING_ATTEMPTS,
  enabled: true,
};

/**
 * Transaction result from API
 */
export interface TransactionResult {
  /** Transaction hash */
  txHash?: string;
  /** Reference ID */
  reference?: string;
  /** Settlement amount (for settlement) */
  settlementAmount?: string;
  /** Exit amount (for early exit) */
  exitAmount?: string;
  /** Penalty amount (for early exit) */
  penaltyAmount?: string;
  /** Final status */
  finalStatus?: string;
  /** Timestamp of completion */
  completedAt?: string;
}

/**
 * Error types for transaction operations
 */
export enum TransactionErrorType {
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  CONCURRENT_TRANSACTION_LIMIT = 'CONCURRENT_TRANSACTION_LIMIT',
  POLLING_TIMEOUT = 'POLLING_TIMEOUT',
  PERSISTENCE_ERROR = 'PERSISTENCE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
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
 * Transaction error structure
 */
export interface TransactionError {
  /** Error type */
  type: TransactionErrorType;
  /** Human-readable message */
  message: string;
  /** Transaction ID */
  transactionId?: string;
  /** Original error (for debugging) */
  originalError?: unknown;
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
  const error: TransactionError = {
    type,
    message: sanitizeErrorMessage(message),
    originalError,
  };
  if (transactionId !== undefined) {
    error.transactionId = transactionId;
  }
  return error;
}
