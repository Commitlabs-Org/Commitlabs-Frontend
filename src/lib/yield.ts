export type RiskProfile = 'safe' | 'balanced' | 'aggressive';

/**
 * Annual yield rates in basis points (100 bps = 1%), mirroring
 * EscrowContract::calculate_accrued_yield in contracts/escrow/src/lib.rs.
 * Safe: 500 bps (5%)
 * Balanced: 700 bps (7%)
 * Aggressive: 1000 bps (10%)
 */
export const ANNUAL_YIELD_BPS: Record<RiskProfile, number> = {
  safe: 500,
  balanced: 700,
  aggressive: 1000,
} as const;

/**
 * Display APY percentages mirroring ANNUAL_YIELD_BPS.
 */
export const DISPLAY_APY: Record<RiskProfile, number> = {
  safe: 5,
  balanced: 7,
  aggressive: 10,
} as const;

export const MAX_PENALTY_BPS = 10_000n;
export const MAX_AMOUNT_STROOPS = 1_000_000_000_000n; // 1e12 stroops (100,000 XLM / tokens at 7 decimals)
export const MIN_DURATION_DAYS = 1;
export const MAX_DURATION_DAYS = 365;

/**
 * Computes projected yield in stroops using BigInt integer arithmetic identical to
 * calculate_accrued_yield in the Soroban escrow contract (contracts/escrow/src/lib.rs):
 *
 * amount.saturating_mul(annual_yield_bps)
 *       .saturating_mul(duration_days)
 *       / 365
 *       / MAX_PENALTY_BPS (10_000)
 *
 * Floors after each division in the same order as Rust integer division.
 */
export function projectYieldStroops(
  amount: bigint,
  durationDays: number,
  risk: RiskProfile
): bigint {
  if (amount <= 0n || durationDays <= 0) {
    return 0n;
  }
  const bps = BigInt(ANNUAL_YIELD_BPS[risk]);
  const days = BigInt(Math.floor(durationDays));

  // BigInt multiplication does not overflow like fixed-width ints, but amount is bounded
  const product = amount * bps * days;
  const afterDays = product / 365n;
  const result = afterDays / MAX_PENALTY_BPS;

  return result;
}

const STROOP_SCALE = 10_000_000n; // 10^7 stroops = 1 token/XLM

/**
 * Parses a decimal token string (e.g. "1000" or "0.5") into BigInt stroops.
 */
export function parseToStroops(amountStr: string): bigint | null {
  const trimmed = amountStr.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > 7) {
    return null; // Exceeds 7 decimals precision of Stellar stroops
  }
  const wholeStroops = BigInt(whole) * STROOP_SCALE;
  const fractionPadded = fraction.padEnd(7, '0');
  const fractionStroops = BigInt(fractionPadded);
  return wholeStroops + fractionStroops;
}

/**
 * Formats BigInt stroops into a decimal string with up to maxFractionDigits.
 */
export function formatStroops(stroops: bigint, maxFractionDigits = 7): string {
  const isNegative = stroops < 0n;
  const abs = isNegative ? -stroops : stroops;
  const whole = abs / STROOP_SCALE;
  const frac = abs % STROOP_SCALE;

  let fracStr = frac.toString().padStart(7, '0');
  // Trim trailing zeros
  fracStr = fracStr.replace(/0+$/, '');

  if (maxFractionDigits < 7) {
    fracStr = fracStr.slice(0, maxFractionDigits);
    fracStr = fracStr.replace(/0+$/, '');
  }

  const sign = isNegative ? '-' : '';
  const wholeFormatted = whole.toLocaleString('en-US');

  if (!fracStr) {
    return `${sign}${wholeFormatted}`;
  }
  return `${sign}${wholeFormatted}.${fracStr}`;
}
