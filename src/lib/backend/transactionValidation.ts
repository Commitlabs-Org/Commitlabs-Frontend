/**
 * Authorization and validation utilities for settlement and early-exit operations.
 * Provides reusable boundary checks for transaction-producing actions.
 */

import { ForbiddenError, ValidationError } from '@/lib/backend/errors';

/**
 * Numeric bounds for settlement and early-exit operations.
 * These protect against both accidental errors and hostile input.
 */
export const TRANSACTION_BOUNDS = {
  // Minimum amount that can be settled/exited (in base units, e.g., stroops)
  MIN_AMOUNT: '1',

  // Maximum amount that can be settled/exited (e.g., 1 billion USD equivalent)
  // Prevents integer overflow and catches data corruption
  MAX_AMOUNT: '1000000000000000', // 10^15 base units

  // Maximum decimal places for numeric amounts
  MAX_DECIMALS: 18,

  // Maximum length for addresses and other identifiers
  MAX_ADDRESS_LENGTH: 256,

  // Maximum length for transaction hashes
  MAX_HASH_LENGTH: 256,
} as const;

/**
 * Validate numeric amount against bounds.
 * @throws ValidationError if amount is out of bounds or malformed
 */
export function validateAmountBounds(amount: string | number, fieldName = 'amount'): string {
  if (amount === undefined || amount === null || amount === '') {
    throw new ValidationError(`${fieldName} is required`);
  }

  const amountStr = String(amount).trim();

  // Check for valid numeric format (handles scientific notation, decimals, etc.)
  if (!/^[0-9]+(\.[0-9]+)?$/.test(amountStr)) {
    throw new ValidationError(`${fieldName} must be a valid numeric value`);
  }

  // Parse as BigInt for bounds checking (without decimals)
  const parts = amountStr.split('.');
  if (parts[1] && parts[1].length > TRANSACTION_BOUNDS.MAX_DECIMALS) {
    throw new ValidationError(
      `${fieldName} decimal places exceed maximum (${TRANSACTION_BOUNDS.MAX_DECIMALS})`,
    );
  }

  // For bounds checking, treat as integer (multiply by 10^decimals if needed)
  const integerPart = parts[0];
  const decimalLength = parts[1]?.length ?? 0;

  // Check minimum bound
  if (integerPart === '0' && decimalLength === 0) {
    throw new ValidationError(`${fieldName} must be greater than ${TRANSACTION_BOUNDS.MIN_AMOUNT}`);
  }

  // Check maximum bound (using string length as proxy for BigInt comparison)
  const normalizedAmount = integerPart + (parts[1] ?? '').padEnd(18, '0');
  if (normalizedAmount.length > TRANSACTION_BOUNDS.MAX_AMOUNT.length) {
    throw new ValidationError(`${fieldName} exceeds maximum bound`);
  }

  if (
    normalizedAmount.length === TRANSACTION_BOUNDS.MAX_AMOUNT.length &&
    normalizedAmount > TRANSACTION_BOUNDS.MAX_AMOUNT
  ) {
    throw new ValidationError(`${fieldName} exceeds maximum bound`);
  }

  return amountStr;
}

/**
 * Validate address format and bounds.
 * @throws ValidationError if address is malformed
 */
export function validateAddressBounds(address: string | undefined, fieldName = 'address'): string {
  if (!address || !address.trim()) {
    throw new ValidationError(`${fieldName} is required`);
  }

  const trimmed = address.trim();

  if (trimmed.length > TRANSACTION_BOUNDS.MAX_ADDRESS_LENGTH) {
    throw new ValidationError(
      `${fieldName} exceeds maximum length (${TRANSACTION_BOUNDS.MAX_ADDRESS_LENGTH})`,
    );
  }

  // Basic Stellar public key format check (56 alphanumeric chars starting with G)
  if (!/^[A-Z0-9]{56}$/.test(trimmed)) {
    throw new ValidationError(`${fieldName} must be a valid Stellar public key`);
  }

  return trimmed;
}

/**
 * Validate transaction hash format (typically 64 hex chars).
 * @throws ValidationError if hash is malformed
 */
export function validateHashBounds(hash: string | undefined, fieldName = 'hash'): string {
  if (!hash || !hash.trim()) {
    throw new ValidationError(`${fieldName} is required`);
  }

  const trimmed = hash.trim();

  if (trimmed.length > TRANSACTION_BOUNDS.MAX_HASH_LENGTH) {
    throw new ValidationError(
      `${fieldName} exceeds maximum length (${TRANSACTION_BOUNDS.MAX_HASH_LENGTH})`,
    );
  }

  // Basic hex string check (64 chars for typical tx hashes)
  if (!/^[a-f0-9]{64}$/.test(trimmed)) {
    throw new ValidationError(`${fieldName} must be a valid hex string (64 chars)`);
  }

  return trimmed;
}

/**
 * Verify ownership: caller must equal owner.
 * Protects against authorization bypass via parameter tampering.
 * @throws ForbiddenError if verification fails
 */
export function verifyOwnership(callerAddress: string, ownerAddress: string | undefined): void {
  if (!ownerAddress || !ownerAddress.trim()) {
    throw new ForbiddenError('Commitment has no owner address (data corruption)');
  }

  const normalizedCaller = callerAddress.trim();
  const normalizedOwner = ownerAddress.trim();

  // Case-sensitive comparison for Stellar addresses
  if (normalizedCaller !== normalizedOwner) {
    throw new ForbiddenError(
      'You are not authorized to perform this action. Ownership verification failed.',
      {
        reason: 'caller_not_owner',
      },
    );
  }
}

/**
 * Verify that a session address matches the caller address.
 * Protects against session hijacking and wrong-wallet scenarios.
 * @throws ForbiddenError if verification fails
 */
export function verifySessionConsistency(sessionAddress: string, callerAddress: string): void {
  const normalizedSession = sessionAddress.trim();
  const normalizedCaller = callerAddress.trim();

  if (normalizedSession !== normalizedCaller) {
    throw new ForbiddenError(
      'Session authentication failed. Wallet address does not match authenticated session.',
      {
        reason: 'session_wallet_mismatch',
      },
    );
  }
}

/**
 * Check transaction response for malformed or unexpected data.
 * Validates critical fields to detect network corruption or malicious responses.
 * @throws ValidationError if response is malformed
 */
export function validateTransactionResponse(response: any, operationType = 'transaction'): void {
  if (!response || typeof response !== 'object') {
    throw new ValidationError(`${operationType} response must be an object`);
  }

  // Validate essential fields depending on operation type
  if (!response.txHash && typeof response.txHash !== 'string') {
    throw new ValidationError(`${operationType} response missing or malformed txHash`);
  }

  if (response.txHash && response.txHash.trim().length > TRANSACTION_BOUNDS.MAX_HASH_LENGTH) {
    throw new ValidationError(`${operationType} txHash exceeds maximum length`);
  }

  // Validate status field
  if (response.finalStatus && typeof response.finalStatus !== 'string') {
    throw new ValidationError(`${operationType} finalStatus must be a string`);
  }

  // Validate amounts if present
  if (response.settlementAmount !== undefined) {
    validateAmountBounds(response.settlementAmount, 'settlementAmount');
  }

  if (response.exitAmount !== undefined) {
    validateAmountBounds(response.exitAmount, 'exitAmount');
  }

  if (response.penaltyAmount !== undefined) {
    validateAmountBounds(response.penaltyAmount, 'penaltyAmount');
  }
}

/**
 * Enum for settlement state transitions.
 * Defines the only valid state transitions.
 */
export const VALID_SETTLEMENT_TRANSITIONS = {
  // States that can transition to SETTLED
  canSettle: ['FUNDED', 'ACTIVE'],
  // States that cannot settle
  cannotSettle: ['SETTLED', 'VIOLATED', 'EARLY_EXIT', 'CREATED', 'PENDING'],
  // States that can transition to EARLY_EXIT
  canEarlyExit: ['FUNDED', 'ACTIVE'],
  // States that cannot early exit
  cannotEarlyExit: ['EARLY_EXIT', 'SETTLED', 'VIOLATED', 'CREATED', 'PENDING'],
} as const;

/**
 * Verify that a commitment can be settled.
 * @throws Error with specific reason if settlement is not allowed
 */
export function verifyCanSettle(commitmentStatus: string): void {
  if (VALID_SETTLEMENT_TRANSITIONS.cannotSettle.includes(commitmentStatus as any)) {
    const reasons: Record<string, string> = {
      SETTLED: 'Commitment has already been settled',
      VIOLATED: 'Commitment has been violated and cannot be settled',
      EARLY_EXIT: 'Commitment has already been exited early',
      CREATED: 'Commitment must be funded before settlement',
      PENDING: 'Commitment is pending and not ready for settlement',
    };
    throw new Error(
      reasons[commitmentStatus] || `Cannot settle commitment in ${commitmentStatus} state`,
    );
  }

  if (!VALID_SETTLEMENT_TRANSITIONS.canSettle.includes(commitmentStatus as any)) {
    throw new Error(`Commitment in ${commitmentStatus} state cannot be settled`);
  }
}

/**
 * Verify that a commitment can be exited early.
 * @throws Error with specific reason if early exit is not allowed
 */
export function verifyCanEarlyExit(commitmentStatus: string): void {
  if (VALID_SETTLEMENT_TRANSITIONS.cannotEarlyExit.includes(commitmentStatus as any)) {
    const reasons: Record<string, string> = {
      EARLY_EXIT: 'Commitment has already been exited early',
      SETTLED: 'Commitment has already been settled and cannot be exited',
      VIOLATED: 'Commitment has been violated',
      CREATED: 'Commitment must be funded before early exit',
      PENDING: 'Commitment is pending and not ready for early exit',
    };
    throw new Error(
      reasons[commitmentStatus] || `Cannot exit commitment in ${commitmentStatus} state`,
    );
  }

  if (!VALID_SETTLEMENT_TRANSITIONS.canEarlyExit.includes(commitmentStatus as any)) {
    throw new Error(`Commitment in ${commitmentStatus} state cannot be exited early`);
  }
}
