// src/app/commitments/[id]/authorization.test.ts
//
// Unit tests for the security-relevant helpers added to
// src/app/commitments/[id]/page.tsx for issue #1754: route parameter
// validation, ownership/authorization derivation, and defensive status
// parsing. These are pure functions, tested directly rather than through a
// full page render, since that would require mocking a large number of
// unrelated UI dependencies the page also imports.

import { describe, it, expect } from 'vitest';
import {
  isValidCommitmentId,
  deriveOwnership,
  ownershipDisabledReason,
  isAuthorized,
  isKnownStatusValue,
  isEligibleForEarlyExit,
  type OwnershipState,
} from './page';

const OWNER_ADDRESS = `G${'A'.repeat(55)}`;
const OTHER_ADDRESS = `G${'B'.repeat(55)}`;

describe('isValidCommitmentId', () => {
  it('accepts a simple numeric id', () => {
    expect(isValidCommitmentId('1')).toBe(true);
  });

  it('accepts an alphanumeric id with hyphens and underscores', () => {
    expect(isValidCommitmentId('abc-123_XYZ')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidCommitmentId('')).toBe(false);
  });

  it('rejects a value longer than 64 characters', () => {
    expect(isValidCommitmentId('a'.repeat(65))).toBe(false);
  });

  it('accepts a value at exactly the 64 character boundary', () => {
    expect(isValidCommitmentId('a'.repeat(64))).toBe(true);
  });

  it('rejects path traversal attempts', () => {
    expect(isValidCommitmentId('../../etc/passwd')).toBe(false);
  });

  it('rejects a value containing a script tag', () => {
    expect(isValidCommitmentId('<script>alert(1)</script>')).toBe(false);
  });

  it('rejects a value containing whitespace', () => {
    expect(isValidCommitmentId('1 2')).toBe(false);
  });

  it('rejects a value containing a slash', () => {
    expect(isValidCommitmentId('1/2')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidCommitmentId(123)).toBe(false);
    expect(isValidCommitmentId(null)).toBe(false);
    expect(isValidCommitmentId(undefined)).toBe(false);
    expect(isValidCommitmentId(['1'])).toBe(false);
  });
});

describe('deriveOwnership', () => {
  it('reports wallet_disconnected when the wallet is not connected', () => {
    const result = deriveOwnership(
      { connected: false, address: '', error: null },
      OWNER_ADDRESS,
    );
    expect(result).toEqual({ kind: 'wallet_disconnected' });
  });

  it('reports wallet_disconnected when connected but address is empty', () => {
    const result = deriveOwnership(
      { connected: true, address: '', error: null },
      OWNER_ADDRESS,
    );
    expect(result).toEqual({ kind: 'wallet_disconnected' });
  });

  it('reports wrong_network with the underlying wallet error message when present', () => {
    const result = deriveOwnership(
      {
        connected: true,
        address: OWNER_ADDRESS,
        error: 'Your wallet is connected to the wrong network. Switch Freighter to the correct network and try again.',
      },
      OWNER_ADDRESS,
    );
    expect(result).toEqual({
      kind: 'wrong_network',
      reason:
        'Your wallet is connected to the wrong network. Switch Freighter to the correct network and try again.',
    });
  });

  it('reports not_owner when the connected address does not match the commitment owner', () => {
    const result = deriveOwnership(
      { connected: true, address: OTHER_ADDRESS, error: null },
      OWNER_ADDRESS,
    );
    expect(result).toEqual({ kind: 'not_owner' });
  });

  it('reports authorized when connected, no error, and address matches the owner exactly', () => {
    const result = deriveOwnership(
      { connected: true, address: OWNER_ADDRESS, error: null },
      OWNER_ADDRESS,
    );
    expect(result).toEqual({ kind: 'authorized' });
  });

  it('is case-sensitive when comparing addresses (Stellar addresses are case-sensitive)', () => {
    const result = deriveOwnership(
      { connected: true, address: OWNER_ADDRESS.toLowerCase(), error: null },
      OWNER_ADDRESS,
    );
    expect(result.kind).toBe('not_owner');
  });

  it('treats a network error as taking priority over an address mismatch', () => {
    // If the wallet reports an error (e.g. wrong network), that's the more
    // actionable problem to surface first, even if address also mismatches.
    const result = deriveOwnership(
      { connected: true, address: OTHER_ADDRESS, error: 'network mismatch' },
      OWNER_ADDRESS,
    );
    expect(result.kind).toBe('wrong_network');
  });
});

describe('ownershipDisabledReason', () => {
  it('returns a connect-wallet message for wallet_disconnected', () => {
    expect(ownershipDisabledReason({ kind: 'wallet_disconnected' })).toMatch(/connect your wallet/i);
  });

  it("returns the underlying reason for wrong_network", () => {
    expect(ownershipDisabledReason({ kind: 'wrong_network', reason: 'custom message' })).toBe(
      'custom message',
    );
  });

  it('returns an owner-only message for not_owner', () => {
    expect(ownershipDisabledReason({ kind: 'not_owner' })).toMatch(/only the commitment owner/i);
  });

  it('returns undefined for authorized', () => {
    expect(ownershipDisabledReason({ kind: 'authorized' })).toBeUndefined();
  });
});

describe('isAuthorized', () => {
  it.each<[OwnershipState, boolean]>([
    [{ kind: 'wallet_disconnected' }, false],
    [{ kind: 'wrong_network', reason: 'x' }, false],
    [{ kind: 'not_owner' }, false],
    [{ kind: 'authorized' }, true],
  ])('returns %s for %j', (state, expected) => {
    expect(isAuthorized(state)).toBe(expected);
  });
});

describe('isKnownStatusValue', () => {
  it('accepts known status values case-insensitively', () => {
    expect(isKnownStatusValue('active')).toBe(true);
    expect(isKnownStatusValue('ACTIVE')).toBe(true);
    expect(isKnownStatusValue('Settled')).toBe(true);
    expect(isKnownStatusValue('violated')).toBe(true);
    expect(isKnownStatusValue('early_exit')).toBe(true);
    expect(isKnownStatusValue('disputed')).toBe(true);
  });

  it('rejects an unrecognized status string', () => {
    expect(isKnownStatusValue('totally-made-up-status')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isKnownStatusValue('')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isKnownStatusValue(undefined)).toBe(false);
    expect(isKnownStatusValue(null)).toBe(false);
    expect(isKnownStatusValue(123)).toBe(false);
    expect(isKnownStatusValue({})).toBe(false);
  });
});

describe('isEligibleForEarlyExit', () => {
  it('is eligible when status is active and daysRemaining is positive', () => {
    expect(isEligibleForEarlyExit({ status: 'active', daysRemaining: 5 })).toBe(true);
  });

  it('is not eligible when daysRemaining is zero', () => {
    expect(isEligibleForEarlyExit({ status: 'active', daysRemaining: 0 })).toBe(false);
  });

  it('is not eligible when daysRemaining is negative', () => {
    expect(isEligibleForEarlyExit({ status: 'active', daysRemaining: -1 })).toBe(false);
  });

  it('is not eligible when status is settled', () => {
    expect(isEligibleForEarlyExit({ status: 'settled', daysRemaining: 5 })).toBe(false);
  });

  it('is not eligible when status is an unrecognized value (malformed response)', () => {
    expect(isEligibleForEarlyExit({ status: 'garbage', daysRemaining: 5 })).toBe(false);
  });

  it('is not eligible when status is an empty string (malformed response)', () => {
    expect(isEligibleForEarlyExit({ status: '', daysRemaining: 5 })).toBe(false);
  });

  it('is not eligible when daysRemaining is missing', () => {
    expect(isEligibleForEarlyExit({ status: 'active' })).toBe(false);
  });

  it('is not eligible when daysRemaining is a non-numeric string', () => {
    expect(isEligibleForEarlyExit({ status: 'active', daysRemaining: 'five' })).toBe(false);
  });

  it('is not eligible when daysRemaining is NaN', () => {
    expect(isEligibleForEarlyExit({ status: 'active', daysRemaining: NaN })).toBe(false);
  });

  it('is not eligible when daysRemaining is Infinity', () => {
    expect(isEligibleForEarlyExit({ status: 'active', daysRemaining: Infinity })).toBe(false);
  });

  it('is not eligible when status is null', () => {
    expect(isEligibleForEarlyExit(null)).toBe(false);
  });

  it('is not eligible when status is undefined (still loading)', () => {
    expect(isEligibleForEarlyExit(undefined)).toBe(false);
  });

  it('is not eligible when status is not an object', () => {
    expect(isEligibleForEarlyExit('active')).toBe(false);
    expect(isEligibleForEarlyExit(42)).toBe(false);
  });
});
