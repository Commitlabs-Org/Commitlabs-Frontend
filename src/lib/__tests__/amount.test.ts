import { describe, expect, it } from 'vitest';
import {
  AMOUNT_ERROR_MESSAGES,
  MAX_AMOUNT,
  MAX_DAYS,
  STELLAR_DECIMALS,
  formatAmount,
  parseAmount,
  parseDays,
  penaltyOf,
  percentToBps,
  yieldOf,
} from '../amount';

const reasonOf = (input: string, decimals?: number) => {
  const r = parseAmount(input, decimals);
  return r.ok ? null : r.reason;
};

describe('parseAmount', () => {
  it.each([
    ['1e3', 'invalid_characters'],
    ['1E3', 'invalid_characters'],
    ['0x10', 'invalid_characters'],
    ['.5.', 'invalid_characters'],
    ['.5', 'invalid_characters'],
    ['5.', 'invalid_characters'],
    ['-1', 'invalid_characters'],
    ['+1', 'invalid_characters'],
    ['1,000', 'invalid_characters'],
    ['1 000', 'invalid_characters'],
    ['abc', 'invalid_characters'],
    ['Infinity', 'invalid_characters'],
    ['１２', 'invalid_characters'],
    ['5\n5', 'invalid_characters'],
    ['', 'empty'],
    ['   ', 'empty'],
    ['\t\n', 'empty'],
    ['0', 'zero'],
    ['0.0', 'zero'],
    ['0.0000000', 'zero'],
  ])('rejects %j as %s', (input, reason) => {
    expect(reasonOf(input)).toBe(reason);
  });

  it('gives every rejection reason a distinct user-facing message', () => {
    const messages = Object.values(AMOUNT_ERROR_MESSAGES);
    expect(new Set(messages).size).toBe(messages.length);
    expect(AMOUNT_ERROR_MESSAGES.zero).toMatch(/greater than zero/);
  });

  it('trims surrounding whitespace but not whitespace inside the number', () => {
    expect(parseAmount(' 5 ')).toEqual({ ok: true, value: 50_000_000n });
    expect(parseAmount('\t5.5\n')).toEqual({ ok: true, value: 55_000_000n });
    expect(reasonOf('5 5')).toBe('invalid_characters');
  });

  it('accepts plain integers and decimals, including leading zeros', () => {
    expect(parseAmount('5')).toEqual({ ok: true, value: 50_000_000n });
    expect(parseAmount('12.5')).toEqual({ ok: true, value: 125_000_000n });
    expect(parseAmount('007')).toEqual({ ok: true, value: 70_000_000n });
    expect(parseAmount('0.5')).toEqual({ ok: true, value: 5_000_000n });
  });

  it('accepts 1 stroop and rejects an 8th decimal', () => {
    expect(parseAmount('0.0000001')).toEqual({ ok: true, value: 1n });
    expect(reasonOf('0.00000001')).toBe('too_many_decimals');
    expect(reasonOf('1.00000000')).toBe('too_many_decimals');
  });

  it('honours a custom decimals parameter', () => {
    expect(parseAmount('1.5', 2)).toEqual({ ok: true, value: 150n });
    expect(reasonOf('1.555', 2)).toBe('too_many_decimals');
    expect(parseAmount('42', 0)).toEqual({ ok: true, value: 42n });
    expect(reasonOf('42.0', 0)).toBe('too_many_decimals');
    expect(() => parseAmount('1', -1)).toThrow(RangeError);
    expect(() => parseAmount('1', 1.5)).toThrow(RangeError);
  });

  it('accepts exactly the contract maximum and rejects one stroop above', () => {
    expect(MAX_AMOUNT).toBe(10n ** 12n);
    expect(parseAmount('100000')).toEqual({ ok: true, value: MAX_AMOUNT });
    expect(parseAmount('100000.0000000')).toEqual({ ok: true, value: MAX_AMOUNT });
    expect(reasonOf('100000.0000001')).toBe('above_max');
    expect(reasonOf('100001')).toBe('above_max');
    expect(reasonOf('1000000000000000000000')).toBe('above_max');
    expect(reasonOf('9'.repeat(500))).toBe('above_max');
  });

  it('never loses precision that a float would', () => {
    expect(parseAmount('0.1234567')).toEqual({ ok: true, value: 1_234_567n });
    expect(parseAmount('99999.9999999')).toEqual({ ok: true, value: 999_999_999_999n });
  });
});

describe('parseDays', () => {
  it.each([
    ['1e1', 'invalid_characters'],
    ['14.0', 'invalid_characters'],
    ['-3', 'invalid_characters'],
    ['+7', 'invalid_characters'],
    ['0x10', 'invalid_characters'],
    ['1 4', 'invalid_characters'],
    ['', 'empty'],
    ['  ', 'empty'],
    ['0', 'below_min'],
    ['366', 'above_max'],
    ['99999999999999999999999', 'above_max'],
  ])('rejects %j as %s', (input, reason) => {
    const r = parseDays(input);
    expect(r.ok ? null : r.reason).toBe(reason);
  });

  it('trims surrounding whitespace like parseAmount', () => {
    expect(parseDays(' 7 ')).toEqual({ ok: true, value: 7 });
  });

  it('checks the inclusive range, defaulting to 1..365', () => {
    expect(parseDays('1')).toEqual({ ok: true, value: 1 });
    expect(parseDays(String(MAX_DAYS))).toEqual({ ok: true, value: 365 });
    expect(parseDays('13', { min: 14 })).toEqual({ ok: false, reason: 'below_min' });
    expect(parseDays('14', { min: 14 })).toEqual({ ok: true, value: 14 });
    expect(parseDays('31', { max: 30 })).toEqual({ ok: false, reason: 'above_max' });
  });
});

describe('formatAmount', () => {
  it('round trips parse then format at full precision', () => {
    const cases: [string, string][] = [
      ['1', '1'],
      ['1000', '1,000'],
      ['12.50', '12.5'],
      ['0.0000001', '0.0000001'],
      ['99999.9999999', '99,999.9999999'],
      ['100000', '100,000'],
      ['0.1234567', '0.1234567'],
    ];
    for (const [input, shown] of cases) {
      const parsed = parseAmount(input);
      expect(parsed.ok && formatAmount(parsed.value)).toBe(shown);
      expect(parseAmount(shown.replace(/,/g, ''))).toEqual(parsed);
    }
  });

  it('shows 1 stroop as 0.0000001 at full precision', () => {
    expect(formatAmount(1n)).toBe('0.0000001');
    expect(formatAmount(10_000_001n)).toBe('1.0000001');
  });

  it('groups thousands and trims trailing zeros', () => {
    expect(formatAmount(10_000_000_000n)).toBe('1,000');
    expect(formatAmount(12_345_678_900_000n)).toBe('1,234,567.89');
    expect(formatAmount(5_000_000n)).toBe('0.5');
    expect(formatAmount(0n)).toBe('0');
  });

  it('truncates to maxFraction instead of rounding', () => {
    expect(formatAmount(19_999_999n, 7, { maxFraction: 2 })).toBe('1.99');
    expect(formatAmount(19_999_999n)).toBe('1.9999999');
    expect(formatAmount(10_000_000n, 7, { maxFraction: 2 })).toBe('1');
    expect(formatAmount(15_000_000n, 7, { maxFraction: 0 })).toBe('1');
  });

  it('does not show a non-zero amount as 0 when truncated', () => {
    expect(formatAmount(1n, 7, { maxFraction: 2 })).toBe('<0.01');
    expect(formatAmount(99_999n, 7, { maxFraction: 2 })).toBe('<0.01');
    expect(formatAmount(1n, 7, { maxFraction: 0 })).toBe('<1');
    expect(formatAmount(0n, 7, { maxFraction: 2 })).toBe('0');
  });

  it('formats with other decimals and negative values', () => {
    expect(formatAmount(150n, 2)).toBe('1.5');
    expect(formatAmount(42n, 0)).toBe('42');
    expect(formatAmount(-5_000_000n)).toBe('-0.5');
  });
});

describe('basis point math', () => {
  it('converts percentages to basis points exactly', () => {
    expect(percentToBps(4.5)).toBe(450n);
    expect(percentToBps(9)).toBe(900n);
    expect(percentToBps(16)).toBe(1_600n);
    expect(percentToBps(0.07)).toBe(7n);
  });

  it('computes the penalty as amount * bps / 10_000 (hand calculated)', () => {
    // 1,000 USDC at 5%: 10_000_000_000 * 500 / 10_000 = 500_000_000 (50 USDC)
    expect(penaltyOf(10_000_000_000n, 5)).toBe(500_000_000n);
    // 2,500 USDC at 3% = 75 USDC
    expect(penaltyOf(25_000_000_000n, 3)).toBe(750_000_000n);
    // 100,000 at 8% = 8,000
    expect(penaltyOf(MAX_AMOUNT, 8)).toBe(80_000_000_000n);
  });

  it('rounds the penalty down to a whole stroop, like the contract', () => {
    // 33 stroops at 5%: 33 * 500 / 10_000 = 1.65, floored to 1; refund 32
    expect(penaltyOf(33n, 5)).toBe(1n);
    expect(33n - penaltyOf(33n, 5)).toBe(32n);
    // 1 stroop at 5% is 0.05, floored to 0
    expect(penaltyOf(1n, 5)).toBe(0n);
  });

  it('computes yield as amount * apyBps * days / (365 * 10_000) (hand calculated)', () => {
    // 365 days at 16% on 100: 1_000_000_000 * 1600 * 365 / (365 * 10_000) = 160_000_000 exactly
    expect(yieldOf(1_000_000_000n, 16, 365)).toBe(160_000_000n);
    // 1,000 at 9% for 14 days: 10_000_000_000 * 900 * 14 / 3_650_000 = 34_520_547.945..., floored
    expect(yieldOf(10_000_000_000n, 9, 14)).toBe(34_520_547n);
    // 2,500 at 4.5% for 7 days: 25_000_000_000 * 450 * 7 / 3_650_000 = 21_575_342.46..., floored
    expect(yieldOf(25_000_000_000n, 4.5, 7)).toBe(21_575_342n);
  });

  it('floors once at the end, never promising more than base units can pay', () => {
    const amount = 12_345_678n;
    const exact = Number(amount) * 0.09 * 14 / 365;
    const got = yieldOf(amount, 9, 14);
    expect(Number(got)).toBeLessThanOrEqual(exact);
    expect(exact - Number(got)).toBeLessThan(1);
  });

  it('handles the maximum amount', () => {
    // 1e12 * 1600 * 365 / (365 * 1e4) = 1.6e11 exactly
    expect(yieldOf(MAX_AMOUNT, 16, 365)).toBe(160_000_000_000n);
    expect(STELLAR_DECIMALS).toBe(7);
  });
});
