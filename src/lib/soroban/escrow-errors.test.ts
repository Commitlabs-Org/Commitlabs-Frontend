import { describe, it, expect } from 'vitest';
import { Errors } from './escrow-client';

describe('Escrow Contract Errors Pinning', () => {
  /**
   * Pinned mapping of stable error codes (1-15) relied upon by the frontend UI and error normalizer.
   * Any change or renumbering in the contract ABI will fail this test.
   */
  const EXPECTED_UI_ERROR_CODES: Record<number, string> = {
    1: 'AlreadyInitialized',
    2: 'NotInitialized',
    3: 'NotFound',
    4: 'Unauthorized',
    5: 'InvalidAmount',
    6: 'InvalidState',
    7: 'NotMatured',
    8: 'InvalidDuration',
    9: 'PenaltyTooHigh',
    10: 'InsufficientYieldPool',
    11: 'Paused',
    12: 'AssetMismatch',
    13: 'InsufficientBalance',
    14: 'CommitmentViolated',
    15: 'InvalidWasmHash',
  };

  it('matches the pinned snapshot of UI-dependent error codes 1-15', () => {
    const errorCodes = Object.keys(EXPECTED_UI_ERROR_CODES).map(Number);

    const actualSnapshot = errorCodes.reduce<Record<number, string>>((acc, code) => {
      const entry = (Errors as Record<number, { message: string }>)[code];
      acc[code] = entry?.message;
      return acc;
    }, {});

    expect(actualSnapshot).toEqual(EXPECTED_UI_ERROR_CODES);
  });

  it('pins each individual error code to protect against renumbering drift', () => {
    for (const [codeStr, expectedMessage] of Object.entries(EXPECTED_UI_ERROR_CODES)) {
      const code = Number(codeStr);
      const entry = (Errors as Record<number, { message: string }>)[code];
      expect(entry, `Error code ${code} must exist in generated contract Errors`).toBeDefined();
      expect(entry.message).toBe(expectedMessage);
    }
  });

  it('exports generated Errors map containing at least all 15 UI codes', () => {
    for (let code = 1; code <= 15; code++) {
      expect((Errors as Record<number, { message: string }>)[code]).toBeDefined();
      expect((Errors as Record<number, { message: string }>)[code].message).toBe(
        EXPECTED_UI_ERROR_CODES[code]
      );
    }
  });
});
