import { describe, it, expect } from 'vitest';
import { validateSupportedAsset, validateStellarAddress, SUPPORTED_ASSETS } from './validation';
import { ValidationError } from './errors';

const VALID_SAMPLE_ADDRESS = 'GABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQHGPC';

describe('validateSupportedAsset', () => {
  it('accepts supported assets', () => {
    for (const asset of SUPPORTED_ASSETS) {
      expect(() => validateSupportedAsset(asset, 'asset')).not.toThrow();
    }
  });

  it('accepts supported assets case-insensitively', () => {
    expect(() => validateSupportedAsset('usdc', 'asset')).not.toThrow();
    expect(() => validateSupportedAsset('Xlm', 'asset')).not.toThrow();
  });

  it('rejects unsupported assets with ValidationError', () => {
    let caught: unknown;
    try {
      validateSupportedAsset('ETH', 'asset');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).code).toBe('VALIDATION_ERROR');
    expect((caught as ValidationError).statusCode).toBe(400);
    expect((caught as ValidationError).message).toContain('not supported');
  });

  it('rejects empty and whitespace assets', () => {
    expect(() => validateSupportedAsset('', 'asset')).toThrow(ValidationError);
    expect(() => validateSupportedAsset('   ', 'asset')).toThrow(ValidationError);
  });
});

describe('validateStellarAddress', () => {
  it('accepts a canonical Stellar G-address', () => {
    expect(() => validateStellarAddress(VALID_SAMPLE_ADDRESS, 'ownerAddress')).not.toThrow();
  });

  it('rejects malformed addresses with ValidationError', () => {
    const invalid = [
      '',
      'abc',
      'invalid-address',
      '1'.repeat(56),
      'O'.repeat(56),
      VALID_SAMPLE_ADDRESS.replace('G', 'H'),
      VALID_SAMPLE_ADDRESS.slice(0, 55),
      VALID_SAMPLE_ADDRESS.toLowerCase(),
    ];
    for (const address of invalid) {
      let caught: unknown;
      try {
        validateStellarAddress(address, 'ownerAddress');
      } catch (e) {
        caught = e;
      }
      expect(caught, `expected rejection for: ${address}`).toBeInstanceOf(ValidationError);
      expect((caught as ValidationError).statusCode).toBe(400);
    }
  });

  it('rejects non-string input', () => {
    expect(() => validateStellarAddress(undefined as unknown as string, 'ownerAddress')).toThrow(
      ValidationError,
    );
  });
});

describe('SUPPORTED_ASSETS', () => {
  it('contains XLM and USDC', () => {
    expect(SUPPORTED_ASSETS).toContain('XLM');
    expect(SUPPORTED_ASSETS).toContain('USDC');
  });
});
