/**
 * Tests for transaction state machine with invariants and validation.
 */

import { describe, it, expect } from 'vitest';
import { TransactionStateMachine } from '../transactionStateMachine';
import {
  validateTransactionMetadata,
  isTransactionStale,
  sanitizeErrorMessage,
  createTransactionError,
} from '../transactionStateMachine';
import type { TransactionMetadata } from '../transactionTypes';
import { TRANSACTION_BOUNDS, TransactionErrorType } from '../transactionTypes';

describe('TransactionStateMachine', () => {
  describe('state transitions', () => {
    it('should transition from idle to pending', () => {
      const machine = new TransactionStateMachine('idle');
      const error = machine.transition('pending');
      expect(error).toBeNull();
      expect(machine.getState()).toBe('pending');
    });

    it('should transition from pending to confirming', () => {
      const machine = new TransactionStateMachine('pending');
      const error = machine.transition('confirming');
      expect(error).toBeNull();
      expect(machine.getState()).toBe('confirming');
    });

    it('should transition from confirming to confirmed', () => {
      const machine = new TransactionStateMachine('confirming');
      const error = machine.transition('confirmed');
      expect(error).toBeNull();
      expect(machine.getState()).toBe('confirmed');
    });

    it('should transition from pending to rejected', () => {
      const machine = new TransactionStateMachine('pending');
      const error = machine.transition('rejected');
      expect(error).toBeNull();
      expect(machine.getState()).toBe('rejected');
    });

    it('should transition from rejected to reconciliation', () => {
      const machine = new TransactionStateMachine('rejected');
      const error = machine.transition('reconciliation');
      expect(error).toBeNull();
      expect(machine.getState()).toBe('reconciliation');
    });

    it('should transition from reconciliation to pending', () => {
      const machine = new TransactionStateMachine('reconciliation');
      const error = machine.transition('pending');
      expect(error).toBeNull();
      expect(machine.getState()).toBe('pending');
      expect(machine.getRetryCount()).toBe(1);
    });

    it('should transition from failed to idle', () => {
      const machine = new TransactionStateMachine('failed');
      const error = machine.transition('idle');
      expect(error).toBeNull();
      expect(machine.getState()).toBe('idle');
    });

    it('should reject invalid state transitions', () => {
      const machine = new TransactionStateMachine('idle');
      const error = machine.transition('confirmed');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('Invalid transition');
      expect(machine.getState()).toBe('idle');
    });

    it('should reject transitions to same state', () => {
      const machine = new TransactionStateMachine('pending');
      const error = machine.transition('pending');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('cannot transition from pending to itself');
    });

    it('should reject transitions from terminal states', () => {
      const machine = new TransactionStateMachine('confirmed');
      const error = machine.transition('pending');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('Cannot transition from terminal state');
    });

    it('should enforce retry bounds', () => {
      const machine = new TransactionStateMachine('rejected');
      
      // Exhaust retry attempts
      for (let i = 0; i < TRANSACTION_BOUNDS.MAX_RETRY_ATTEMPTS; i++) {
        machine.transition('pending');
        machine.transition('rejected');
      }
      
      const error = machine.transition('pending');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('Max retry attempts');
    });
  });

  describe('state queries', () => {
    it('should identify terminal states', () => {
      const confirmedMachine = new TransactionStateMachine('confirmed');
      const failedMachine = new TransactionStateMachine('failed');
      
      expect(confirmedMachine.isTerminal()).toBe(true);
      expect(failedMachine.isTerminal()).toBe(true);
      
      const pendingMachine = new TransactionStateMachine('pending');
      expect(pendingMachine.isTerminal()).toBe(false);
    });

    it('should identify recoverable states', () => {
      const rejectedMachine = new TransactionStateMachine('rejected');
      const reconciliationMachine = new TransactionStateMachine('reconciliation');
      
      expect(rejectedMachine.isRecoverable()).toBe(true);
      expect(reconciliationMachine.isRecoverable()).toBe(true);
      
      const confirmedMachine = new TransactionStateMachine('confirmed');
      expect(confirmedMachine.isRecoverable()).toBe(false);
    });

    it('should check if retry is possible', () => {
      const machine = new TransactionStateMachine('rejected');
      expect(machine.canRetry()).toBe(true);
      
      // Exhaust retries
      for (let i = 0; i < TRANSACTION_BOUNDS.MAX_RETRY_ATTEMPTS; i++) {
        machine.transition('pending');
        machine.transition('rejected');
      }
      
      expect(machine.canRetry()).toBe(false);
    });
  });

  describe('metadata creation', () => {
    it('should create metadata snapshot', () => {
      const machine = new TransactionStateMachine('pending');
      const metadata = machine.toMetadata(
        'tx_123',
        'settlement',
        'commitment_456',
        { callerAddress: 'GABC...' }
      );
      
      expect(metadata.id).toBe('tx_123');
      expect(metadata.type).toBe('settlement');
      expect(metadata.commitmentId).toBe('commitment_456');
      expect(metadata.state).toBe('pending');
      expect(metadata.callerAddress).toBe('GABC...');
      expect(metadata.retryCount).toBe(0);
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.updatedAt).toBeDefined();
    });

    it('should reset state', () => {
      const machine = new TransactionStateMachine('failed');
      machine.transition('pending');
      machine.transition('failed');
      
      machine.reset();
      
      expect(machine.getState()).toBe('idle');
      expect(machine.getRetryCount()).toBe(0);
    });
  });
});

describe('validateTransactionMetadata', () => {
  it('should validate valid metadata', () => {
    const metadata: TransactionMetadata = {
      id: 'tx_123',
      type: 'settlement',
      commitmentId: 'commitment_456',
      state: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
    };
    
    const error = validateTransactionMetadata(metadata);
    expect(error).toBeNull();
  });

  it('should reject missing transaction ID', () => {
    const metadata = {
      id: '',
      type: 'settlement' as const,
      commitmentId: 'commitment_456',
      state: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
    };
    
    const error = validateTransactionMetadata(metadata);
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Transaction ID is required');
  });

  it('should reject missing commitment ID', () => {
    const metadata = {
      id: 'tx_123',
      type: 'settlement' as const,
      commitmentId: '',
      state: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
    };
    
    const error = validateTransactionMetadata(metadata);
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Commitment ID is required');
  });

  it('should reject excessive retry count', () => {
    const metadata: TransactionMetadata = {
      id: 'tx_123',
      type: 'settlement',
      commitmentId: 'commitment_456',
      state: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: TRANSACTION_BOUNDS.MAX_RETRY_ATTEMPTS + 1,
    };
    
    const error = validateTransactionMetadata(metadata);
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Retry count');
  });

  it('should reject oversized error message', () => {
    const metadata: TransactionMetadata = {
      id: 'tx_123',
      type: 'settlement',
      commitmentId: 'commitment_456',
      state: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      error: 'A'.repeat(TRANSACTION_BOUNDS.MAX_ERROR_MESSAGE_LENGTH + 1),
    };
    
    const error = validateTransactionMetadata(metadata);
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Error message exceeds maximum length');
  });

  it('should reject invalid timestamp format', () => {
    const metadata = {
      id: 'tx_123',
      type: 'settlement' as const,
      commitmentId: 'commitment_456',
      state: 'pending' as const,
      createdAt: 'invalid-date',
      updatedAt: new Date().toISOString(),
      retryCount: 0,
    };
    
    const error = validateTransactionMetadata(metadata);
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Invalid timestamp format');
  });

  it('should reject updated timestamp before created timestamp', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000);
    
    const metadata = {
      id: 'tx_123',
      type: 'settlement' as const,
      commitmentId: 'commitment_456',
      state: 'pending' as const,
      createdAt: now.toISOString(),
      updatedAt: past.toISOString(),
      retryCount: 0,
    };
    
    const error = validateTransactionMetadata(metadata);
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Updated timestamp cannot be before created timestamp');
  });
});

describe('isTransactionStale', () => {
  it('should identify stale transactions', () => {
    const oldDate = new Date(Date.now() - TRANSACTION_BOUNDS.TRANSACTION_STATE_TTL_MS - 1000);
    
    const metadata: TransactionMetadata = {
      id: 'tx_123',
      type: 'settlement',
      commitmentId: 'commitment_456',
      state: 'pending',
      createdAt: oldDate.toISOString(),
      updatedAt: oldDate.toISOString(),
      retryCount: 0,
    };
    
    expect(isTransactionStale(metadata)).toBe(true);
  });

  it('should not identify fresh transactions as stale', () => {
    const recentDate = new Date();
    
    const metadata: TransactionMetadata = {
      id: 'tx_123',
      type: 'settlement',
      commitmentId: 'commitment_456',
      state: 'pending',
      createdAt: recentDate.toISOString(),
      updatedAt: recentDate.toISOString(),
      retryCount: 0,
    };
    
    expect(isTransactionStale(metadata)).toBe(false);
  });
});

describe('sanitizeErrorMessage', () => {
  it('should truncate long error messages', () => {
    const longError = 'A'.repeat(TRANSACTION_BOUNDS.MAX_ERROR_MESSAGE_LENGTH + 100);
    const sanitized = sanitizeErrorMessage(longError);
    
    expect(sanitized.length).toBe(TRANSACTION_BOUNDS.MAX_ERROR_MESSAGE_LENGTH);
  });

  it('should handle Error objects', () => {
    const error = new Error('Test error message');
    const sanitized = sanitizeErrorMessage(error);
    
    expect(sanitized).toBe('Test error message');
  });

  it('should handle string errors', () => {
    const sanitized = sanitizeErrorMessage('String error');
    expect(sanitized).toBe('String error');
  });

  it('should handle unknown errors', () => {
    const sanitized = sanitizeErrorMessage(12345);
    expect(sanitized).toBe('An unknown error occurred');
  });
});

describe('createTransactionError', () => {
  it('should create error with all fields', () => {
    const error = createTransactionError(
      TransactionErrorType.VALIDATION_ERROR,
      'Test error',
      'tx_123',
      new Error('Original error')
    );
    
    expect(error.type).toBe(TransactionErrorType.VALIDATION_ERROR);
    expect(error.message).toBe('Test error');
    expect(error.transactionId).toBe('tx_123');
    expect(error.originalError).toBeInstanceOf(Error);
  });

  it('should create error without optional fields', () => {
    const error = createTransactionError(
      TransactionErrorType.NETWORK_ERROR,
      'Network failed'
    );
    
    expect(error.type).toBe(TransactionErrorType.NETWORK_ERROR);
    expect(error.message).toBe('Network failed');
    expect(error.transactionId).toBeUndefined();
    expect(error.originalError).toBeUndefined();
  });

  it('should sanitize error message', () => {
    const longError = 'A'.repeat(TRANSACTION_BOUNDS.MAX_ERROR_MESSAGE_LENGTH + 100);
    const error = createTransactionError(
      TransactionErrorType.VALIDATION_ERROR,
      longError
    );
    
    expect(error.message.length).toBe(TRANSACTION_BOUNDS.MAX_ERROR_MESSAGE_LENGTH);
  });
});
