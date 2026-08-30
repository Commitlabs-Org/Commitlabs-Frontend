/**
 * Transaction persistence layer for browser refresh resilience.
 * Uses localStorage with explicit bounds, validation, and cleanup.
 */

import type {
  TransactionMetadata,
  TransactionError,
} from './transactionTypes';
import {
  TRANSACTION_BOUNDS,
  TransactionErrorType,
  createTransactionError,
} from './transactionTypes';
import {
  validateTransactionMetadata,
  isTransactionStale,
} from './transactionStateMachine';

/**
 * Storage key prefix for transaction data
 */
const STORAGE_KEY_PREFIX = 'transaction_';

/**
 * Maximum number of transactions to store per commitment
 */
const MAX_TRANSACTIONS_PER_COMMITMENT = 5;

/**
 * Get storage key for a transaction
 */
function getStorageKey(transactionId: string): string {
  return `${STORAGE_KEY_PREFIX}${transactionId}`;
}

/**
 * Get storage key for commitment transaction index
 */
function getCommitmentIndexKey(commitmentId: string): string {
  return `${STORAGE_KEY_PREFIX}index_${commitmentId}`;
}

/**
 * Serialize transaction metadata to JSON with size bounds
 */
function serializeTransaction(metadata: TransactionMetadata): string {
  const json = JSON.stringify(metadata);
  
  // Invariant: Enforce size bounds
  if (json.length > TRANSACTION_BOUNDS.MAX_METADATA_SIZE_BYTES) {
    throw new Error(`Transaction metadata exceeds maximum size of ${TRANSACTION_BOUNDS.MAX_METADATA_SIZE_BYTES} bytes`);
  }
  
  return json;
}

/**
 * Deserialize transaction metadata from JSON with validation
 */
function deserializeTransaction(json: string): TransactionMetadata {
  try {
    const metadata = JSON.parse(json) as TransactionMetadata;
    const validationError = validateTransactionMetadata(metadata);
    if (validationError) {
      throw new Error(validationError.message);
    }
    return metadata;
  } catch (error) {
    throw new Error(`Failed to deserialize transaction: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Save transaction metadata to localStorage
 */
export function saveTransaction(metadata: TransactionMetadata): TransactionError | null {
  try {
    // Validate before saving
    const validationError = validateTransactionMetadata(metadata);
    if (validationError) {
      return validationError;
    }

    const key = getStorageKey(metadata.id);
    const serialized = serializeTransaction(metadata);
    
    // Save transaction
    localStorage.setItem(key, serialized);
    
    // Update commitment index
    updateCommitmentIndex(metadata.commitmentId, metadata.id);
    
    // Cleanup stale transactions
    cleanupStaleTransactions(metadata.commitmentId);
    
    return null;
  } catch (error) {
    return createTransactionError(
      TransactionErrorType.PERSISTENCE_ERROR,
      `Failed to save transaction: ${error instanceof Error ? error.message : String(error)}`,
      metadata.id,
      error,
    );
  }
}

/**
 * Load transaction metadata from localStorage
 */
export function loadTransaction(transactionId: string): TransactionMetadata | null {
  try {
    const key = getStorageKey(transactionId);
    const serialized = localStorage.getItem(key);
    
    if (!serialized) {
      return null;
    }
    
    const metadata = deserializeTransaction(serialized);
    
    // Check if transaction is stale
    if (isTransactionStale(metadata)) {
      deleteTransaction(transactionId);
      return null;
    }
    
    return metadata;
  } catch {
    // If loading fails, delete the corrupted data
    deleteTransaction(transactionId);
    return null;
  }
}

/**
 * Delete transaction from localStorage
 */
export function deleteTransaction(transactionId: string): void {
  const key = getStorageKey(transactionId);
  localStorage.removeItem(key);
  
  // Also remove from any commitment indices
  try {
    const allKeys = Object.keys(localStorage);
    const indexKeys = allKeys.filter(k => k.startsWith(`${STORAGE_KEY_PREFIX}index_`));
    
    for (const indexKey of indexKeys) {
      const index = JSON.parse(localStorage.getItem(indexKey) || '[]') as string[];
      const updatedIndex = index.filter(id => id !== transactionId);
      localStorage.setItem(indexKey, JSON.stringify(updatedIndex));
    }
  } catch {
    // Ignore index cleanup errors
  }
}

/**
 * Update commitment transaction index
 */
function updateCommitmentIndex(commitmentId: string, transactionId: string): void {
  const indexKey = getCommitmentIndexKey(commitmentId);
  const existingIndex = JSON.parse(localStorage.getItem(indexKey) || '[]') as string[];
  
  // Add transaction ID if not already present
  if (!existingIndex.includes(transactionId)) {
    existingIndex.unshift(transactionId); // Add to front
    
    // Enforce bound on number of transactions per commitment
    if (existingIndex.length > MAX_TRANSACTIONS_PER_COMMITMENT) {
      const removedId = existingIndex.pop();
      if (removedId) {
        deleteTransaction(removedId);
      }
    }
    
    localStorage.setItem(indexKey, JSON.stringify(existingIndex));
  }
}

/**
 * Get all transactions for a commitment
 */
export function getCommitmentTransactions(commitmentId: string): TransactionMetadata[] {
  try {
    const indexKey = getCommitmentIndexKey(commitmentId);
    const index = JSON.parse(localStorage.getItem(indexKey) || '[]') as string[];
    
    const transactions: TransactionMetadata[] = [];
    for (const transactionId of index) {
      const metadata = loadTransaction(transactionId);
      if (metadata) {
        transactions.push(metadata);
      }
    }
    
    return transactions;
  } catch {
    return [];
  }
}

/**
 * Get the most recent transaction for a commitment
 */
export function getLatestTransaction(commitmentId: string): TransactionMetadata | null {
  const transactions = getCommitmentTransactions(commitmentId);
  if (transactions.length === 0) {
    return null;
  }
  
  // Sort by updated timestamp descending
  const sorted = transactions.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return sorted[0] ?? null;
}

/**
 * Check if there's an active transaction for a commitment
 */
export function hasActiveTransaction(commitmentId: string): boolean {
  const latest = getLatestTransaction(commitmentId);
  if (!latest) {
    return false;
  }
  
  // Active if not in terminal state and not stale
  return !['confirmed', 'failed'].includes(latest.state) && !isTransactionStale(latest);
}

/**
 * Update transaction state
 */
export function updateTransactionState(
  transactionId: string,
  newState: TransactionMetadata['state'],
  additionalFields: Partial<TransactionMetadata> = {},
): TransactionError | null {
  const metadata = loadTransaction(transactionId);
  if (!metadata) {
    return createTransactionError(
      TransactionErrorType.PERSISTENCE_ERROR,
      'Transaction not found',
      transactionId,
    );
  }
  
  const updatedMetadata: TransactionMetadata = {
    ...metadata,
    state: newState,
    updatedAt: new Date().toISOString(),
    ...additionalFields,
  };
  
  return saveTransaction(updatedMetadata);
}

/**
 * Cleanup stale transactions for a commitment
 */
export function cleanupStaleTransactions(commitmentId: string): void {
  const transactions = getCommitmentTransactions(commitmentId);
  
  for (const transaction of transactions) {
    if (isTransactionStale(transaction)) {
      deleteTransaction(transaction.id);
    }
  }
}

/**
 * Cleanup all stale transactions across all commitments
 */
export function cleanupAllStaleTransactions(): void {
  try {
    const allKeys = Object.keys(localStorage);
    const transactionKeys = allKeys.filter(k => k.startsWith(STORAGE_KEY_PREFIX) && !k.includes('index_'));
    
    for (const key of transactionKeys) {
      const serialized = localStorage.getItem(key);
      if (serialized) {
        try {
          const metadata = deserializeTransaction(serialized);
          if (isTransactionStale(metadata)) {
            localStorage.removeItem(key);
          }
        } catch {
          // Remove corrupted data
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Clear all transaction data (for testing or logout)
 */
export function clearAllTransactions(): void {
  try {
    const allKeys = Object.keys(localStorage);
    const transactionKeys = allKeys.filter(k => k.startsWith(STORAGE_KEY_PREFIX));
    
    for (const key of transactionKeys) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore clear errors
  }
}

/**
 * Get transaction count for a commitment
 */
export function getTransactionCount(commitmentId: string): number {
  return getCommitmentTransactions(commitmentId).length;
}

/**
 * Check if transaction exists
 */
export function transactionExists(transactionId: string): boolean {
  return loadTransaction(transactionId) !== null;
}

/**
 * Initialize persistence layer (call on app startup)
 */
export function initializePersistence(): void {
  // Cleanup stale transactions on initialization
  cleanupAllStaleTransactions();
  
  // Listen for storage events from other tabs
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('storage', (event) => {
      if (event.key && event.key.startsWith(STORAGE_KEY_PREFIX)) {
        // Handle storage changes from other tabs if needed
        // This could trigger state updates in React components
      }
    });
  }
}
