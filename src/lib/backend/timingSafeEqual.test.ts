import { describe, it, expect } from 'vitest';
import { safeEqualToken } from './timingSafeEqual';

describe('safeEqualToken', () => {
  it('returns true for byte-identical values', () => {
    expect(safeEqualToken('shared-secret', 'shared-secret')).toBe(true);
  });

  it('returns true for two empty values', () => {
    expect(safeEqualToken('', '')).toBe(true);
  });

  it('returns false for same-length values that differ', () => {
    expect(safeEqualToken('shared-secreT', 'shared-secreX')).toBe(false);
  });

  it('returns false when the lengths differ instead of throwing', () => {
    // Buffer lengths must be equal for crypto.timingSafeEqual, so a naive
    // wrapper leaks a RangeError on every length mismatch.
    expect(() => safeEqualToken('short', 'a-much-longer-secret')).not.toThrow();
    expect(safeEqualToken('short', 'a-much-longer-secret')).toBe(false);
    expect(safeEqualToken('a-much-longer-secret', 'short')).toBe(false);
  });

  it('returns false when one value is empty and the other is not', () => {
    expect(safeEqualToken('', 'secret')).toBe(false);
  });

  it('compares by bytes, so differing only in the final character is still a mismatch', () => {
    expect(safeEqualToken('secret1', 'secret2')).toBe(false);
  });

  it('handles multi-byte characters without a false positive', () => {
    expect(safeEqualToken('秘密', '秘密')).toBe(true);
    expect(safeEqualToken('秘密', '密秘')).toBe(false);
    // Same character count, different byte length: must not throw.
    expect(safeEqualToken('秘密', 'ab')).toBe(false);
  });
});
