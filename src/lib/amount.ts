/**
 * Exact fixed-point amounts. User input is parsed into bigint base units (7
 * decimals for Stellar assets) so nothing on the money path touches a float.
 */

/** Stellar assets, including XLM, carry 7 decimals (1 unit = 10^7 stroops). */
export const STELLAR_DECIMALS = 7;

/** Mirrors `MAX_AMOUNT` in contracts/escrow/src/lib.rs: 1e12 stroops = 100,000 XLM. */
export const MAX_AMOUNT = 1_000_000_000_000n;

/** Longest lock the wizard accepts, in days. */
export const MAX_DAYS = 365;

const BPS_DENOMINATOR = 10_000n;
const DAYS_PER_YEAR = 365n;

export type AmountError =
  | 'empty'
  | 'invalid_characters'
  | 'too_many_decimals'
  | 'zero'
  | 'above_max';

export type AmountResult = { ok: true; value: bigint } | { ok: false; reason: AmountError };

export const AMOUNT_ERROR_MESSAGES: Record<AmountError, string> = {
  empty: 'Enter an amount.',
  invalid_characters: 'Use digits and one decimal point only, like 12.5. No signs, commas or exponents.',
  too_many_decimals: 'Too many decimal places. Stellar assets support up to 7.',
  zero: 'Enter an amount greater than zero.',
  above_max: 'That is above the maximum of 100,000 per commitment.',
};

const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

/**
 * Parses a decimal string into base units.
 *
 * Whitespace policy: leading and trailing whitespace is trimmed, so " 5 " is
 * accepted as 5; whitespace inside the number ("1 000") is rejected. Only
 * `^\d+(\.\d+)?$` is accepted after trimming, so ".5", "5.", "1e3", "0x10",
 * "-1" and "1,000" are all `invalid_characters`. Leading zeros are allowed.
 */
export function parseAmount(input: string, decimals = STELLAR_DECIMALS): AmountResult {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 38) {
    throw new RangeError(`decimals must be an integer from 0 to 38, got ${decimals}`);
  }

  const text = input.trim();
  if (text === '') return { ok: false, reason: 'empty' };
  if (!AMOUNT_PATTERN.test(text)) return { ok: false, reason: 'invalid_characters' };

  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) return { ok: false, reason: 'too_many_decimals' };

  const value = BigInt(whole + fraction.padEnd(decimals, '0'));
  if (value === 0n) return { ok: false, reason: 'zero' };
  if (value > MAX_AMOUNT) return { ok: false, reason: 'above_max' };
  return { ok: true, value };
}

export interface FormatOptions {
  /**
   * Cap on fraction digits. Extra digits are truncated, never rounded, so a
   * summary never shows more than the real amount. A non-zero value that
   * truncates to zero shows as "<0.01" rather than "0". Omit for full precision.
   */
  maxFraction?: number;
}

/** Formats base units as a grouped decimal string, trimming trailing zeros. */
export function formatAmount(
  value: bigint,
  decimals = STELLAR_DECIMALS,
  { maxFraction }: FormatOptions = {},
): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  let fraction = digits.slice(digits.length - decimals);

  if (maxFraction !== undefined) fraction = fraction.slice(0, Math.max(0, maxFraction));
  fraction = fraction.replace(/0+$/, '');

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = negative ? '-' : '';

  if (maxFraction !== undefined && value !== 0n && grouped === '0' && fraction === '') {
    const smallest = maxFraction > 0 ? `0.${'0'.repeat(maxFraction - 1)}1` : '1';
    return `<${smallest}`;
  }
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}

export type DaysError = 'empty' | 'invalid_characters' | 'below_min' | 'above_max';

export type DaysResult = { ok: true; value: number } | { ok: false; reason: DaysError };

/**
 * Parses a whole number of days. Same trim policy as `parseAmount`; digits
 * only, so "1e1", "14.0", "-3" and "+7" are rejected. "0" is `below_min`.
 */
export function parseDays(input: string, { min = 1, max = MAX_DAYS } = {}): DaysResult {
  const text = input.trim();
  if (text === '') return { ok: false, reason: 'empty' };
  if (!/^\d+$/.test(text)) return { ok: false, reason: 'invalid_characters' };

  const value = Number(text);
  if (value < min) return { ok: false, reason: 'below_min' };
  if (value > max) return { ok: false, reason: 'above_max' };
  return { ok: true, value };
}

/** Converts a percentage with at most 2 decimals (4.5) to basis points (450). */
export function percentToBps(percent: number): bigint {
  return BigInt(Math.round(percent * 100));
}

/**
 * Early exit penalty: `amount * bps / 10_000`, rounded down like the contract's
 * `compute_refund_amount`. The refund is `amount - penalty`, so no stroop is lost.
 */
export function penaltyOf(amount: bigint, penaltyPercent: number): bigint {
  return (amount * percentToBps(penaltyPercent)) / BPS_DENOMINATOR;
}

/**
 * Simple-interest yield: `amount * apyBps * days / (365 * 10_000)`, rounded down
 * once at the end (the contract's `calculate_accrued_yield` floors the same way),
 * so the projection never promises more than the base-unit math can pay.
 */
export function yieldOf(amount: bigint, apyPercent: number, days: number): bigint {
  return (amount * percentToBps(apyPercent) * BigInt(days)) / (DAYS_PER_YEAR * BPS_DENOMINATOR);
}
