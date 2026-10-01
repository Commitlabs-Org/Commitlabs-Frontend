/**
 * Transaction lifecycle management module.
 * Exports all transaction-related functionality for settlement and early-exit operations.
 */

// Types and constants
export type {
  TransactionType,
  TransactionState,
  TransactionMetadata,
  TransitionValidationResult,
  TelemetryEventType,
  TelemetryEvent,
  PollingConfig,
  TransactionResult,
  TransactionError,
} from './transactionTypes';

export {
  TRANSACTION_BOUNDS,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  RECOVERABLE_STATES,
  DEFAULT_POLLING_CONFIG,
  TransactionErrorType,
  sanitizeErrorMessage,
  createTransactionError,
} from './transactionTypes';

// State machine
export {
  TransactionStateMachine,
  validateTransactionMetadata,
  isTransactionStale,
} from './transactionStateMachine';

// Polling
export {
  pollWithBounds,
  createTimeoutAbortController,
  debouncePolling,
  throttlePolling,
  calculateBackoffInterval,
  pollWithBackoff,
} from './transactionPolling';

export type {
  PollingResult,
  PollingOptions,
} from './transactionPolling';

// Persistence
export {
  saveTransaction,
  loadTransaction,
  deleteTransaction,
  getCommitmentTransactions,
  getLatestTransaction,
  hasActiveTransaction,
  updateTransactionState,
  cleanupStaleTransactions,
  cleanupAllStaleTransactions,
  clearAllTransactions,
  getTransactionCount,
  transactionExists,
  initializePersistence,
} from './transactionPersistence';

// Telemetry
export {
  createTelemetryEvent,
  recordTelemetryEvent,
  getTransactionTelemetry,
  getAllTelemetryEvents,
  getTelemetryEventsByType,
  clearTelemetry,
  calculateTelemetryStatistics,
  getTransactionDiagnostics,
  calculatePerformanceMetrics,
  exportTelemetryData,
} from './transactionTelemetry';

export type {
  TelemetryStatistics,
  TransactionDiagnostics,
  PerformanceMetrics,
} from './transactionTelemetry';
