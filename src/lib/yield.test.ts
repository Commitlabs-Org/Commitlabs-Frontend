import { describe, it, expect } from 'vitest';
import {
  projectYieldStroops,
  parseToStroops,
  formatStroops,
  ANNUAL_YIELD_BPS,
  DISPLAY_APY,
  MAX_AMOUNT_STROOPS,
} from './yield';

/**
 * Hand-computed contract formula:
 * (amount * bps * days) / 365 / 10_000
 * using integer floor at each division.
 */
function contractAccruedYield(amount: bigint, days: number, bps: number): bigint {
  const product = amount * BigInt(bps) * BigInt(days);
  const afterDays = product / 365n;
  return afterDays / 10_000n;
}

describe('yield.ts - projectYieldStroops & helpers', () => {
  it('mirrors the contract rates of 500 / 700 / 1000 bps and 5% / 7% / 10% APY', () => {
    expect(ANNUAL_YIELD_BPS.safe).toBe(500);
    expect(ANNUAL_YIELD_BPS.balanced).toBe(700);
    expect(ANNUAL_YIELD_BPS.aggressive).toBe(1000);

    expect(DISPLAY_APY.safe).toBe(5);
    expect(DISPLAY_APY.balanced).toBe(7);
    expect(DISPLAY_APY.aggressive).toBe(10);
  });

  // Table of 12+ rigorous test cases
  const testCases: Array<{
    name: string;
    amount: bigint;
    days: number;
    risk: 'safe' | 'balanced' | 'aggressive';
    expected: bigint;
  }> = [
    // 1. Edge case: 1 stroop, 1 day, Safe
    {
      name: '1 stroop, 1 day, Safe -> rounds down to 0',
      amount: 1n,
      days: 1,
      risk: 'safe',
      expected: contractAccruedYield(1n, 1, 500), // (1 * 500 * 1)/365 = 1 / 10000 = 0
    },
    // 2. Edge case: 1 stroop, 365 days, Safe
    {
      name: '1 stroop, 365 days, Safe -> rounds down to 0',
      amount: 1n,
      days: 365,
      risk: 'safe',
      expected: contractAccruedYield(1n, 365, 500),
    },
    // 3. Edge case: 1 stroop, 365 days, Aggressive
    {
      name: '1 stroop, 365 days, Aggressive -> rounds down to 0',
      amount: 1n,
      days: 365,
      risk: 'aggressive',
      expected: contractAccruedYield(1n, 365, 1000),
    },
    // 4. Exactly 10,000 stroops (0.001 token), 365 days, Aggressive (1000 bps = 10%)
    {
      name: '10,000 stroops, 365 days, Aggressive -> exactly 1,000 stroops',
      amount: 10_000n,
      days: 365,
      risk: 'aggressive',
      expected: 1000n,
    },
    // 5. 10,000 stroops, 365 days, Safe (500 bps = 5%)
    {
      name: '10,000 stroops, 365 days, Safe -> exactly 500 stroops',
      amount: 10_000n,
      days: 365,
      risk: 'safe',
      expected: 500n,
    },
    // 6. 10,000 stroops, 365 days, Balanced (700 bps = 7%)
    {
      name: '10,000 stroops, 365 days, Balanced -> exactly 700 stroops',
      amount: 10_000n,
      days: 365,
      risk: 'balanced',
      expected: 700n,
    },
    // 7. 10,000,000 stroops (1 token), 30 days, Balanced (7%)
    {
      name: '1 token (10^7 stroops), 30 days, Balanced',
      amount: 10_000_000n,
      days: 30,
      risk: 'balanced',
      expected: contractAccruedYield(10_000_000n, 30, 700),
    },
    // 8. 10,000,000 stroops (1 token), 180 days, Aggressive (10%)
    {
      name: '1 token, 180 days, Aggressive',
      amount: 10_000_000n,
      days: 180,
      risk: 'aggressive',
      expected: contractAccruedYield(10_000_000n, 180, 1000),
    },
    // 9. Typical user amount: 1,000 tokens (10^10 stroops), 365 days, Safe (5%)
    {
      name: '1,000 tokens, 365 days, Safe -> exactly 50 tokens (5*10^8 stroops)',
      amount: 10_000_000_000n,
      days: 365,
      risk: 'safe',
      expected: 500_000_000n,
    },
    // 10. MAX_AMOUNT (1e12 stroops), 1 day, Safe
    {
      name: 'MAX_AMOUNT (1e12 stroops), 1 day, Safe',
      amount: MAX_AMOUNT_STROOPS,
      days: 1,
      risk: 'safe',
      expected: contractAccruedYield(MAX_AMOUNT_STROOPS, 1, 500),
    },
    // 11. MAX_AMOUNT (1e12 stroops), 365 days, Balanced
    {
      name: 'MAX_AMOUNT (1e12 stroops), 365 days, Balanced -> exactly 7e10 stroops',
      amount: MAX_AMOUNT_STROOPS,
      days: 365,
      risk: 'balanced',
      expected: 70_000_000_000n,
    },
    // 12. MAX_AMOUNT (1e12 stroops), 365 days, Aggressive -> exactly 1e11 stroops
    {
      name: 'MAX_AMOUNT (1e12 stroops), 365 days, Aggressive -> exactly 100,000,000,000 stroops',
      amount: MAX_AMOUNT_STROOPS,
      days: 365,
      risk: 'aggressive',
      expected: 100_000_000_000n,
    },
    // 13. Floating point divergence case: (amount * bps * days) has non-zero remainder before and after division
    {
      name: 'Float divergence case with small remainder truncation',
      amount: 123_456_789n,
      days: 47,
      risk: 'balanced',
      expected: contractAccruedYield(123_456_789n, 47, 700),
    },
    // 14. Float divergence case: 999_999_999 stroops for 73 days, Aggressive
    {
      name: 'Float divergence case 2',
      amount: 999_999_999n,
      days: 73,
      risk: 'aggressive',
      expected: contractAccruedYield(999_999_999n, 73, 1000),
    },
  ];

  testCases.forEach(({ name, amount, days, risk, expected }) => {
    it(`calculates exact contract yield for: ${name}`, () => {
      const actual = projectYieldStroops(amount, days, risk);
      expect(actual).toBe(expected);
    });
  });

  it('returns 0n for zero or negative amount or duration', () => {
    expect(projectYieldStroops(0n, 30, 'safe')).toBe(0n);
    expect(projectYieldStroops(-100n, 30, 'safe')).toBe(0n);
    expect(projectYieldStroops(1000n, 0, 'safe')).toBe(0n);
    expect(projectYieldStroops(1000n, -5, 'safe')).toBe(0n);
  });

  describe('parseToStroops & formatStroops', () => {
    it('parses valid token decimal strings to BigInt stroops (7 decimals)', () => {
      expect(parseToStroops('1')).toBe(10_000_000n);
      expect(parseToStroops('1000')).toBe(10_000_000_000n);
      expect(parseToStroops('0.5')).toBe(5_000_000n);
      expect(parseToStroops('0.0000001')).toBe(1n);
      expect(parseToStroops('1000.1234567')).toBe(10_001_234_567n);
    });

    it('rejects invalid strings or precision greater than 7 decimals', () => {
      expect(parseToStroops('')).toBeNull();
      expect(parseToStroops('abc')).toBeNull();
      expect(parseToStroops('-5')).toBeNull();
      expect(parseToStroops('1.12345678')).toBeNull(); // 8 decimals
    });

    it('formats BigInt stroops into decimal string', () => {
      expect(formatStroops(10_000_000n)).toBe('1');
      expect(formatStroops(10_000_000_000n)).toBe('1,000');
      expect(formatStroops(5_000_000n)).toBe('0.5');
      expect(formatStroops(1n)).toBe('0.0000001');
      expect(formatStroops(10_001_234_567n)).toBe('1,000.1234567');
      expect(formatStroops(0n)).toBe('0');
    });
  });
});
