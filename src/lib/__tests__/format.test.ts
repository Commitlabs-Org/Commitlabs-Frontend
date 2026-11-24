import { describe, it, expect } from 'vitest';
import { shortAddress } from '../format';

describe('shortAddress', () => {
  it('shortens a 56-character Stellar address to first4...last4', () => {
    const address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    expect(address).toHaveLength(56);
    expect(shortAddress(address)).toBe('GAAA...AWHF');
  });

  it('returns short strings unchanged', () => {
    expect(shortAddress('SHORT')).toBe('SHORT');
    expect(shortAddress('12345678')).toBe('12345678');
  });

  it('returns an empty string for empty input', () => {
    expect(shortAddress('')).toBe('');
  });
});
