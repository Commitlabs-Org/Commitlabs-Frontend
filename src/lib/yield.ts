import { saturatingMultiplyI128 } from './amount';

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

  const afterBps = saturatingMultiplyI128(amount, bps);
  const product = saturatingMultiplyI128(afterBps, days);
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

/** Maturity horizons (days) used by the protocol coverage forecast. */
export const COVERAGE_HORIZONS = [7, 30, 90] as const;
export type CoverageHorizonDays = (typeof COVERAGE_HORIZONS)[number];

const DAY_MS = 86_400_000;

/** Statuses that still owe yield. Settled, exited, violated and disputed records do not. */
const FORECAST_STATUSES = new Set(['active', 'matured']);

/**
 * Minimal shape needed to forecast yield obligations. Structurally compatible
 * with `Commitment`, but declared here so this module stays importable from
 * `commitments.ts` without a cycle.
 */
export interface ForecastCommitment {
  amount: string | bigint;
  durationDays: number;
  type: RiskProfile;
  createdAt: number;
  status?: string;
}

export interface CoverageBucket {
  horizonDays: CoverageHorizonDays;
  /** Yield owed by commitments maturing within this horizon, in stroops. */
  needStroops: bigint;
  covered: boolean;
  shortfallStroops: bigint;
}

export interface CoverageForecast {
  availableStroops: bigint;
  /** Cumulative buckets: the 30-day need includes the 7-day need, and so on. */
  buckets: CoverageBucket[];
  /** Yield owed by everything maturing within the longest horizon (90 days). */
  totalNeedStroops: bigint;
  covered: boolean;
  shortfallStroops: bigint;
}

/**
 * Forecasts whether the available yield-pool balance covers the yield promised
 * to funded commitments, grouped by maturity horizon. Only commitments that
 * mature within 90 days (including already matured ones) contribute; yield is
 * the full projected amount at maturity, matching the contract's integer math.
 *
 * Pure and dependency-free so it can be unit-tested and shared by pages.
 */
export function coverageForecast(
  commitments: readonly ForecastCommitment[],
  available: bigint,
  now: number,
): CoverageForecast {
  const needByHorizon = new Map<CoverageHorizonDays, bigint>(
    COVERAGE_HORIZONS.map((horizon) => [horizon, 0n]),
  );

  for (const commitment of commitments) {
    if (commitment.status !== undefined && !FORECAST_STATUSES.has(commitment.status)) {
      continue;
    }
    const maturity = commitment.createdAt + commitment.durationDays * DAY_MS;
    if (maturity > now + COVERAGE_HORIZONS[COVERAGE_HORIZONS.length - 1]! * DAY_MS) {
      continue;
    }

    let amount: bigint;
    try {
      amount = BigInt(commitment.amount);
    } catch {
      continue;
    }
    const yieldStroops = projectYieldStroops(amount, commitment.durationDays, commitment.type);

    for (const horizon of COVERAGE_HORIZONS) {
      if (maturity <= now + horizon * DAY_MS) {
        needByHorizon.set(horizon, needByHorizon.get(horizon)! + yieldStroops);
      }
    }
  }

  const buckets: CoverageBucket[] = COVERAGE_HORIZONS.map((horizonDays) => {
    const needStroops = needByHorizon.get(horizonDays)!;
    return {
      horizonDays,
      needStroops,
      covered: available >= needStroops,
      shortfallStroops: needStroops > available ? needStroops - available : 0n,
    };
  });

  const totalNeedStroops = buckets[buckets.length - 1]!.needStroops;

  return {
    availableStroops: available,
    buckets,
    totalNeedStroops,
    covered: available >= totalNeedStroops,
    shortfallStroops: totalNeedStroops > available ? totalNeedStroops - available : 0n,
  };
}
