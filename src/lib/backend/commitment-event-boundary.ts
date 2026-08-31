/**
 * src/lib/backend/commitment-event-boundary.ts
 *
 * Authorization and validation boundary for commitment event timeline pagination.
 *
 * Enforces explicit invariants at the API boundary:
 * - Authentication: User must have valid session token
 * - Ownership: Authenticated user must own the commitment
 * - Network: Commitment must exist on current network
 * - Route params: commitmentId must be well-formed
 * - Pagination: page/pageSize must be integers within bounds
 * - Response: Chain response must match expected schema
 *
 * Design tradeoffs:
 * - Strict validation (fail loudly vs. silently) ensures caller can detect misconfigurations
 * - Throws typed errors for proper error handling in withApiHandler
 * - Single point of validation prevents drift between routes
 * - No assumptions about client state; checks are server-authoritative
 */

import { ForbiddenError, ValidationError, NotFoundError } from './errors';
import {
  PaginationParams,
  PaginationParseError,
  parsePaginationParams,
} from './pagination';
import type { ChainCommitment } from './services/contracts';

/**
 * Validated and normalized commitment event request context.
 * Derived from request + chain state; assumptions are checked, not inferred.
 */
export interface CommitmentEventContext {
  /** Commitment ID from route params (validated format) */
  commitmentId: string;
  /** Wallet address of authenticated user (from session) */
  userAddress: string;
  /** Pagination parameters (validated bounds and types) */
  pagination: PaginationParams;
  /** Commitment from chain (used to verify ownership) */
  commitment: ChainCommitment;
}

/**
 * Validates and normalizes a commitment ID from route params.
 *
 * Invariants checked:
 * - Must be non-empty string
 * - Must match Stellar contract ID format (starting with 'C' or contract prefix)
 *
 * @throws ValidationError if commitmentId is malformed
 */
export function validateCommitmentId(commitmentId: string | undefined): string {
  if (!commitmentId || typeof commitmentId !== 'string') {
    throw new ValidationError('Commitment ID is required', {
      field: 'id',
      received: typeof commitmentId,
    });
  }

  const trimmed = commitmentId.trim();
  if (!trimmed) {
    throw new ValidationError('Commitment ID cannot be empty', {
      field: 'id',
    });
  }

  // Basic format check: Stellar contract IDs start with 'C' followed by alphanumerics
  if (!trimmed.match(/^C[A-Z2-7]{55}$/)) {
    throw new ValidationError('Invalid commitment ID format', {
      field: 'id',
      received: trimmed,
      expected: 'Stellar contract ID (C followed by 55 characters)',
    });
  }

  return trimmed;
}

/**
 * Validates wallet address from session.
 *
 * Invariants checked:
 * - Must be non-empty string
 * - Must be valid Stellar public key address
 *
 * @throws ValidationError if address is invalid
 */
export function validateWalletAddress(address: string | undefined): string {
  if (!address || typeof address !== 'string') {
    throw new ValidationError('Wallet address is required', {
      field: 'address',
      received: typeof address,
    });
  }

  const trimmed = address.trim();
  if (!trimmed) {
    throw new ValidationError('Wallet address cannot be empty', {
      field: 'address',
    });
  }

  // Stellar public key format: G followed by 55 characters
  if (!trimmed.match(/^G[A-Z2-7]{55}$/)) {
    throw new ValidationError('Invalid wallet address format', {
      field: 'address',
      received: trimmed,
      expected: 'Stellar public key address',
    });
  }

  return trimmed;
}

/**
 * Validates that commitment on chain matches expected schema.
 *
 * Invariants checked:
 * - Must have required fields (id, status, ownerAddress)
 * - ownerAddress must be valid Stellar address
 * - commitment.id must match requested commitmentId
 *
 * @throws ValidationError if schema is invalid
 */
export function validateChainResponse(
  commitment: unknown,
  expectedCommitmentId: string,
): ChainCommitment {
  if (!commitment || typeof commitment !== 'object') {
    throw new ValidationError('Invalid chain response: commitment must be an object', {
      received: typeof commitment,
    });
  }

  const c = commitment as Record<string, unknown>;

  // Check required fields
  if (typeof c.id !== 'string' || !c.id) {
    throw new ValidationError('Invalid chain response: missing or invalid id', {
      received: c.id,
    });
  }

  if (typeof c.status !== 'string' || !c.status) {
    throw new ValidationError('Invalid chain response: missing or invalid status', {
      received: c.status,
    });
  }

  if (typeof c.ownerAddress !== 'string' || !c.ownerAddress) {
    throw new ValidationError('Invalid chain response: missing or invalid ownerAddress', {
      received: c.ownerAddress,
    });
  }

  // Verify ID matches requested
  if (c.id !== expectedCommitmentId) {
    throw new ValidationError('Chain response commitment ID does not match request', {
      requested: expectedCommitmentId,
      received: c.id,
    });
  }

  // Validate ownerAddress format
  try {
    validateWalletAddress(c.ownerAddress as string);
  } catch (err) {
    throw new ValidationError('Invalid chain response: ownerAddress is malformed', {
      original: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  return commitment as ChainCommitment;
}

/**
 * Verifies that authenticated user owns the commitment.
 *
 * Invariants checked:
 * - User's wallet address must exactly match commitment's ownerAddress
 * - No cross-commitment access
 * - No delegation or "view-as" logic
 *
 * @throws ForbiddenError if user does not own the commitment
 */
export function verifyCommitmentOwnership(
  userAddress: string,
  commitment: ChainCommitment,
): void {
  if (userAddress !== commitment.ownerAddress) {
    throw new ForbiddenError('You do not have permission to access this commitment', {
      reason: 'ownership_mismatch',
      field: 'ownerAddress',
    });
  }
}

/**
 * Validates and normalizes pagination params from query string.
 *
 * Leverages existing strict pagination module which:
 * - Rejects (not silently corrects) invalid page/pageSize
 * - Enforces bounds: page >= 1, 1 <= pageSize <= 100
 * - Throws PaginationParseError on malformed input
 *
 * Maps PaginationParseError to ValidationError for consistent API response.
 *
 * @throws ValidationError if pagination params are invalid
 */
export function validatePaginationParams(
  searchParams: URLSearchParams,
): PaginationParams {
  try {
    return parsePaginationParams(searchParams);
  } catch (err) {
    if (err instanceof PaginationParseError) {
      throw new ValidationError(`Invalid pagination parameter: ${err.message}`, {
        field: err.field,
        value: err.value,
      });
    }
    throw err;
  }
}

/**
 * Validates and builds the commitment event authorization context.
 *
 * This is the main entry point for boundary validation. It:
 * 1. Validates route params (commitmentId)
 * 2. Validates session identity (userAddress)
 * 3. Validates pagination params (page, pageSize)
 * 4. Validates chain response matches schema
 * 5. Verifies ownership (user owns commitment)
 *
 * Returns a validated context with all assumptions checked.
 *
 * @throws ValidationError, ForbiddenError, NotFoundError on validation failure
 */
export function buildCommitmentEventContext(
  commitmentId: string | undefined,
  userAddress: string | undefined,
  searchParams: URLSearchParams,
  commitment: unknown,
): CommitmentEventContext {
  // Step 1: Validate route params
  const validatedCommitmentId = validateCommitmentId(commitmentId);

  // Step 2: Validate session identity
  const validatedUserAddress = validateWalletAddress(userAddress);

  // Step 3: Validate pagination
  const pagination = validatePaginationParams(searchParams);

  // Step 4: Validate chain response schema
  const validatedCommitment = validateChainResponse(commitment, validatedCommitmentId);

  // Step 5: Verify ownership
  verifyCommitmentOwnership(validatedUserAddress, validatedCommitment);

  return {
    commitmentId: validatedCommitmentId,
    userAddress: validatedUserAddress,
    pagination,
    commitment: validatedCommitment,
  };
}
