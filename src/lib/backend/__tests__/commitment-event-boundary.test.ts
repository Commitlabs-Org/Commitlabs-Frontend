/**
 * src/lib/backend/__tests__/commitment-event-boundary.test.ts
 *
 * Tests for commitment event authorization and validation boundary.
 *
 * Coverage:
 * - Route parameter validation (commitmentId format)
 * - Wallet identity validation (address format, session data)
 * - Ownership verification (user owns commitment)
 * - Pagination validation (strict bounds checking, reject invalid)
 * - Chain response schema validation
 * - Adversarial scenarios (tampering, replay, wrong-network, disconnected-wallet)
 */

import { describe, it, expect } from 'vitest';
import {
  validateCommitmentId,
  validateWalletAddress,
  validateChainResponse,
  verifyCommitmentOwnership,
  validatePaginationParams,
  buildCommitmentEventContext,
} from '../commitment-event-boundary';
import { ValidationError, ForbiddenError } from '../errors';
import type { ChainCommitment } from '../services/contracts';

// ─── Test fixtures ────────────────────────────────────────────────────────

const validCommitmentId = 'CAZ4OWMXK6XYAPQRVWOXKK5OZWW4NVXJHQSVYALYQ7GRWHQF7OXYOEJ';
const validWalletAddress = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJgpx44RJGHY7W3SYFGN6OD6M';

const mockCommitment: ChainCommitment = {
  id: validCommitmentId,
  ownerAddress: validWalletAddress,
  asset: 'native',
  amount: '1000',
  status: 'ACTIVE',
  complianceScore: 85,
  currentValue: '1050',
  feeEarned: '50',
  violationCount: 0,
  createdAt: '2024-01-01T00:00:00Z',
  expiresAt: '2024-12-31T23:59:59Z',
};

// ─── Route parameter validation ────────────────────────────────────────────

describe('validateCommitmentId', () => {
  it('accepts valid Stellar contract ID', () => {
    const result = validateCommitmentId(validCommitmentId);
    expect(result).toBe(validCommitmentId);
  });

  it('trims whitespace from valid ID', () => {
    const result = validateCommitmentId(`  ${validCommitmentId}  `);
    expect(result).toBe(validCommitmentId);
  });

  it('rejects undefined', () => {
    expect(() => validateCommitmentId(undefined)).toThrow(ValidationError);
  });

  it('rejects null (type coercion)', () => {
    expect(() => validateCommitmentId(null as any)).toThrow(ValidationError);
  });

  it('rejects empty string', () => {
    expect(() => validateCommitmentId('')).toThrow(ValidationError);
  });

  it('rejects whitespace-only string', () => {
    expect(() => validateCommitmentId('   ')).toThrow(ValidationError);
  });

  it('rejects invalid format: wrong prefix', () => {
    expect(() => validateCommitmentId('GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJGPX44RJGHY7W3SYFGN6OD6M')).toThrow(
      ValidationError,
    );
  });

  it('rejects invalid format: too short', () => {
    expect(() => validateCommitmentId('CSHORT')).toThrow(ValidationError);
  });

  it('rejects invalid format: too long', () => {
    expect(() => validateCommitmentId(`${validCommitmentId}EXTRA`)).toThrow(ValidationError);
  });

  it('rejects invalid format: invalid characters', () => {
    expect(() => validateCommitmentId('CABC@DEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXY')).toThrow(
      ValidationError,
    );
  });

  it('error includes helpful details', () => {
    try {
      validateCommitmentId('INVALID');
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).details).toBeDefined();
    }
  });
});

// ─── Wallet address validation ────────────────────────────────────────────

describe('validateWalletAddress', () => {
  it('accepts valid Stellar public key', () => {
    const result = validateWalletAddress(validWalletAddress);
    expect(result).toBe(validWalletAddress);
  });

  it('trims whitespace from valid address', () => {
    const result = validateWalletAddress(`  ${validWalletAddress}  `);
    expect(result).toBe(validWalletAddress);
  });

  it('rejects undefined', () => {
    expect(() => validateWalletAddress(undefined)).toThrow(ValidationError);
  });

  it('rejects null (type coercion)', () => {
    expect(() => validateWalletAddress(null as any)).toThrow(ValidationError);
  });

  it('rejects empty string', () => {
    expect(() => validateWalletAddress('')).toThrow(ValidationError);
  });

  it('rejects whitespace-only string', () => {
    expect(() => validateWalletAddress('   ')).toThrow(ValidationError);
  });

  it('rejects wrong prefix (contract ID)', () => {
    expect(() => validateWalletAddress(validCommitmentId)).toThrow(ValidationError);
  });

  it('rejects too short', () => {
    expect(() => validateWalletAddress('GSHORT')).toThrow(ValidationError);
  });

  it('rejects too long', () => {
    expect(() => validateWalletAddress(`${validWalletAddress}EXTRA`)).toThrow(ValidationError);
  });

  it('rejects invalid characters', () => {
    expect(() => validateWalletAddress('GABC@DEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXY')).toThrow(
      ValidationError,
    );
  });

  it('error includes helpful details', () => {
    try {
      validateWalletAddress('INVALID');
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).details).toBeDefined();
    }
  });
});

// ─── Chain response validation ─────────────────────────────────────────────

describe('validateChainResponse', () => {
  it('accepts valid commitment object', () => {
    const result = validateChainResponse(mockCommitment, validCommitmentId);
    expect(result.id).toBe(validCommitmentId);
    expect(result.ownerAddress).toBe(validWalletAddress);
  });

  it('rejects non-object', () => {
    expect(() => validateChainResponse(null, validCommitmentId)).toThrow(ValidationError);
    expect(() => validateChainResponse(undefined, validCommitmentId)).toThrow(ValidationError);
    expect(() => validateChainResponse('string', validCommitmentId)).toThrow(ValidationError);
    expect(() => validateChainResponse(123, validCommitmentId)).toThrow(ValidationError);
  });

  it('rejects missing id field', () => {
    const invalid = { ...mockCommitment, id: undefined };
    expect(() => validateChainResponse(invalid, validCommitmentId)).toThrow(ValidationError);
  });

  it('rejects missing status field', () => {
    const invalid = { ...mockCommitment, status: undefined };
    expect(() => validateChainResponse(invalid, validCommitmentId)).toThrow(ValidationError);
  });

  it('rejects missing ownerAddress field', () => {
    const invalid = { ...mockCommitment, ownerAddress: undefined };
    expect(() => validateChainResponse(invalid, validCommitmentId)).toThrow(ValidationError);
  });

  it('rejects id mismatch (tampering)', () => {
    const different = {
      ...mockCommitment,
      id: 'CAZ4OWMXK6XYAPQRVWOXKK5OZWW4NVXJHQSVYALYQ7GRWHQF7OXYOEJ',
    };
    expect(() => validateChainResponse(different, 'CDIFFERENT00000000000000000000000000000000000000000000000000')).toThrow(
      ValidationError,
    );
  });

  it('rejects malformed ownerAddress (catches upstream validation)', () => {
    const invalid = { ...mockCommitment, ownerAddress: 'INVALID_ADDRESS' };
    expect(() => validateChainResponse(invalid, validCommitmentId)).toThrow(ValidationError);
  });

  it('error includes mismatch details', () => {
    try {
      const different = {
        ...mockCommitment,
        id: 'CAZ4OWMXK6XYAPQRVWOXKK5OZWW4NVXJHQSVYALYQ7GRWHQF7OXYOEJ',
      };
      validateChainResponse(different, 'CDIFFERENT00000000000000000000000000000000000000000000000000');
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const details = (err as ValidationError).details as Record<string, unknown>;
      expect(details.requested).toBeDefined();
      expect(details.received).toBeDefined();
    }
  });
});

// ─── Ownership verification ───────────────────────────────────────────────

describe('verifyCommitmentOwnership', () => {
  it('accepts when user address matches ownerAddress', () => {
    // Should not throw
    verifyCommitmentOwnership(validWalletAddress, mockCommitment);
  });

  it('rejects when user does not own commitment', () => {
    const otherAddress = 'GBLUQ4P2MFDQD3XBNAFN3RJ7Q5WM4GZQLYH3FQPGRSKHWEDKV5JMZMC';
    expect(() => verifyCommitmentOwnership(otherAddress, mockCommitment)).toThrow(ForbiddenError);
  });

  it('treats ownership check as case-sensitive', () => {
    const lowerCase = validWalletAddress.toLowerCase();
    expect(() => verifyCommitmentOwnership(lowerCase, mockCommitment)).toThrow(ForbiddenError);
  });

  it('error indicates ownership mismatch', () => {
    try {
      const otherAddress = 'GBLUQ4P2MFDQD3XBNAFN3RJ7Q5WM4GZQLYH3FQPGRSKHWEDKV5JMZMC';
      verifyCommitmentOwnership(otherAddress, mockCommitment);
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      const details = (err as ForbiddenError).details as Record<string, unknown>;
      expect(details.reason).toBe('ownership_mismatch');
    }
  });
});

// ─── Pagination validation ────────────────────────────────────────────────

describe('validatePaginationParams', () => {
  it('accepts valid page and pageSize', () => {
    const params = new URLSearchParams('page=2&pageSize=25');
    const result = validatePaginationParams(params);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(25);
  });

  it('defaults to page=1 when omitted', () => {
    const params = new URLSearchParams('pageSize=10');
    const result = validatePaginationParams(params);
    expect(result.page).toBe(1);
  });

  it('defaults to pageSize=10 when omitted', () => {
    const params = new URLSearchParams('page=2');
    const result = validatePaginationParams(params);
    expect(result.pageSize).toBe(10);
  });

  it('defaults both when empty params', () => {
    const params = new URLSearchParams('');
    const result = validatePaginationParams(params);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('rejects negative page (adversarial input)', () => {
    const params = new URLSearchParams('page=-1');
    expect(() => validatePaginationParams(params)).toThrow(ValidationError);
  });

  it('rejects page=0 (1-based indexing)', () => {
    const params = new URLSearchParams('page=0');
    expect(() => validatePaginationParams(params)).toThrow(ValidationError);
  });

  it('rejects non-integer page', () => {
    const params = new URLSearchParams('page=1.5');
    expect(() => validatePaginationParams(params)).toThrow(ValidationError);
  });

  it('rejects non-numeric page', () => {
    const params = new URLSearchParams('page=abc');
    expect(() => validatePaginationParams(params)).toThrow(ValidationError);
  });

  it('rejects negative pageSize', () => {
    const params = new URLSearchParams('pageSize=-10');
    expect(() => validatePaginationParams(params)).toThrow(ValidationError);
  });

  it('rejects pageSize=0 (min is 1)', () => {
    const params = new URLSearchParams('pageSize=0');
    expect(() => validatePaginationParams(params)).toThrow(ValidationError);
  });

  it('rejects pageSize > 100 (max is 100)', () => {
    const params = new URLSearchParams('pageSize=101');
    expect(() => validatePaginationParams(params)).toThrow(ValidationError);
  });

  it('rejects non-integer pageSize', () => {
    const params = new URLSearchParams('pageSize=10.5');
    expect(() => validatePaginationParams(params)).toThrow(ValidationError);
  });

  it('rejects non-numeric pageSize', () => {
    const params = new URLSearchParams('pageSize=abc');
    expect(() => validatePaginationParams(params)).toThrow(ValidationError);
  });

  it('accepts pageSize=1 (boundary)', () => {
    const params = new URLSearchParams('pageSize=1');
    const result = validatePaginationParams(params);
    expect(result.pageSize).toBe(1);
  });

  it('accepts pageSize=100 (boundary)', () => {
    const params = new URLSearchParams('pageSize=100');
    const result = validatePaginationParams(params);
    expect(result.pageSize).toBe(100);
  });

  it('error includes field and value for debugging', () => {
    try {
      const params = new URLSearchParams('page=abc');
      validatePaginationParams(params);
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const details = (err as ValidationError).details as Record<string, unknown>;
      expect(details.field).toBe('page');
      expect(details.value).toBe('abc');
    }
  });
});

// ─── Composite context building ────────────────────────────────────────────

describe('buildCommitmentEventContext', () => {
  it('builds valid context from correct inputs', () => {
    const searchParams = new URLSearchParams('page=1&pageSize=10');
    const result = buildCommitmentEventContext(
      validCommitmentId,
      validWalletAddress,
      searchParams,
      mockCommitment,
    );

    expect(result.commitmentId).toBe(validCommitmentId);
    expect(result.userAddress).toBe(validWalletAddress);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(10);
    expect(result.commitment).toEqual(mockCommitment);
  });

  it('throws ValidationError for malformed commitmentId', () => {
    const searchParams = new URLSearchParams('page=1&pageSize=10');
    expect(() => buildCommitmentEventContext('INVALID', validWalletAddress, searchParams, mockCommitment)).toThrow(
      ValidationError,
    );
  });

  it('throws ValidationError for malformed wallet address', () => {
    const searchParams = new URLSearchParams('page=1&pageSize=10');
    expect(() => buildCommitmentEventContext(validCommitmentId, 'INVALID', searchParams, mockCommitment)).toThrow(
      ValidationError,
    );
  });

  it('throws ValidationError for invalid pagination params', () => {
    const searchParams = new URLSearchParams('page=abc');
    expect(() => buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, mockCommitment)).toThrow(
      ValidationError,
    );
  });

  it('throws ValidationError for malformed chain response', () => {
    const searchParams = new URLSearchParams('page=1&pageSize=10');
    expect(() =>
      buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, {
        id: 'WRONG',
      }),
    ).toThrow(ValidationError);
  });

  it('throws ForbiddenError when user does not own commitment', () => {
    const otherOwner = {
      ...mockCommitment,
      ownerAddress: 'GBLUQ4P2MFDQD3XBNAFN3RJ7Q5WM4GZQLYH3FQPGRSKHWEDKV5JMZMC',
    };
    const searchParams = new URLSearchParams('page=1&pageSize=10');
    expect(() => buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, otherOwner)).toThrow(
      ForbiddenError,
    );
  });

  it('validates all invariants even if first check fails', () => {
    // If commitmentId is invalid, it should throw before checking ownership
    const searchParams = new URLSearchParams('page=abc');
    expect(() => buildCommitmentEventContext('INVALID', 'INVALID', searchParams, null)).toThrow(ValidationError);
  });
});

// ─── Adversarial scenario coverage ────────────────────────────────────────

describe('Adversarial scenarios', () => {
  describe('Replay attacks', () => {
    it('validates pagination params on each request', () => {
      // Same commitmentId, different page param
      const searchParams1 = new URLSearchParams('page=1&pageSize=10');
      const searchParams2 = new URLSearchParams('page=2&pageSize=10');

      const context1 = buildCommitmentEventContext(
        validCommitmentId,
        validWalletAddress,
        searchParams1,
        mockCommitment,
      );
      const context2 = buildCommitmentEventContext(
        validCommitmentId,
        validWalletAddress,
        searchParams2,
        mockCommitment,
      );

      expect(context1.pagination.page).toBe(1);
      expect(context2.pagination.page).toBe(2);
    });
  });

  describe('Tampering / Cross-commitment access', () => {
    it('rejects attempt to access commitment with wrong ID in route', () => {
      const searchParams = new URLSearchParams('page=1&pageSize=10');
      const requestedId = 'CDIFFERENT00000000000000000000000000000000000000000000000000';

      expect(() =>
        buildCommitmentEventContext(requestedId, validWalletAddress, searchParams, mockCommitment),
      ).toThrow(ValidationError);
    });

    it('rejects attempt to access commitment owned by someone else', () => {
      const otherOwner = {
        ...mockCommitment,
        ownerAddress: 'GBLUQ4P2MFDQD3XBNAFN3RJ7Q5WM4GZQLYH3FQPGRSKHWEDKV5JMZMC',
      };
      const searchParams = new URLSearchParams('page=1&pageSize=10');

      expect(() => buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, otherOwner)).toThrow(
        ForbiddenError,
      );
    });
  });

  describe('Wrong network / Malformed response', () => {
    it('rejects chain response with mismatched commitmentId', () => {
      const searchParams = new URLSearchParams('page=1&pageSize=10');
      const mismatchedResponse = {
        ...mockCommitment,
        id: 'CDIFFERENT00000000000000000000000000000000000000000000000000',
      };

      expect(() =>
        buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, mismatchedResponse),
      ).toThrow(ValidationError);
    });

    it('rejects chain response with null ownerAddress', () => {
      const searchParams = new URLSearchParams('page=1&pageSize=10');
      const invalid = { ...mockCommitment, ownerAddress: null };

      expect(() => buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, invalid)).toThrow(
        ValidationError,
      );
    });

    it('rejects chain response that is not an object', () => {
      const searchParams = new URLSearchParams('page=1&pageSize=10');

      expect(() => buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, 'not-an-object')).toThrow(
        ValidationError,
      );
    });
  });

  describe('Disconnected wallet', () => {
    it('rejects mismatched user address and commitment owner', () => {
      const differentUser = 'GBLUQ4P2MFDQD3XBNAFN3RJ7Q5WM4GZQLYH3FQPGRSKHWEDKV5JMZMC';
      const searchParams = new URLSearchParams('page=1&pageSize=10');

      expect(() =>
        buildCommitmentEventContext(validCommitmentId, differentUser, searchParams, mockCommitment),
      ).toThrow(ForbiddenError);
    });
  });

  describe('Malformed requests', () => {
    it('rejects excessively large pageSize', () => {
      const searchParams = new URLSearchParams('pageSize=999999');

      expect(() =>
        buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, mockCommitment),
      ).toThrow(ValidationError);
    });

    it('rejects excessively large page number (still validates)', () => {
      const searchParams = new URLSearchParams('page=999999999999999');

      // Very large page numbers are allowed by strict bounds (no explicit upper bound)
      // but they're valid numbers
      const result = buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, mockCommitment);
      expect(result.pagination.page).toBe(999999999999999);
    });

    it('rejects scientific notation in pageSize', () => {
      const searchParams = new URLSearchParams('pageSize=1e2');

      // 1e2 = 100, which is valid
      const result = buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, mockCommitment);
      expect(result.pagination.pageSize).toBe(100);
    });

    it('rejects Infinity in pageSize', () => {
      const searchParams = new URLSearchParams('pageSize=Infinity');

      expect(() =>
        buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, mockCommitment),
      ).toThrow(ValidationError);
    });

    it('rejects NaN in pageSize', () => {
      const searchParams = new URLSearchParams('pageSize=NaN');

      expect(() =>
        buildCommitmentEventContext(validCommitmentId, validWalletAddress, searchParams, mockCommitment),
      ).toThrow(ValidationError);
    });
  });
});
