import type { CommitmentLimits } from '@/utils/protocol';

export const EXPOSURE_ZONE_THRESHOLDS = {
  lowMax: 33,
  mediumMax: 66,
} as const;

export type ExposureLevel = 'low' | 'medium' | 'high';

export interface ValueHistoryPoint {
  date: string;
  currentValue: number;
  initialAmount?: number;
}

export interface DrawdownPoint {
  date: string;
  drawdownPercent: number;
}

export interface CommitmentExposureInput {
  valueHistory?: ValueHistoryPoint[];
  drawdownHistory?: DrawdownPoint[];
  maxLossPercent: number;
  protocolMaxLossPercentCeiling?: number;
}

export interface CommitmentExposureResult {
  status: 'ok' | 'insufficient_data';
  exposurePercent?: number;
  level?: ExposureLevel;
  /** Drawdown chart reference line on 0–1 scale (max loss as fraction). */
  drawdownThresholdPercent?: number;
  zoneThresholds: typeof EXPOSURE_ZONE_THRESHOLDS;
}

const DRAWDOWN_WEIGHT = 0.6;
const VOLATILITY_WEIGHT = 0.4;
/** Scales mean absolute return (0–1) to a 0–100 exposure contribution. */
const VOLATILITY_RETURN_SCALE = 20;
const DEFAULT_PROTOCOL_MAX_LOSS_CEILING = 100;

export function getExposureLevel(
  percent: number,
  thresholds: typeof EXPOSURE_ZONE_THRESHOLDS = EXPOSURE_ZONE_THRESHOLDS,
): ExposureLevel {
  if (percent <= thresholds.lowMax) return 'low';
  if (percent <= thresholds.mediumMax) return 'medium';
  return 'high';
}

export function computeDrawdownThresholdPercent(maxLossPercent: number): number {
  if (!Number.isFinite(maxLossPercent) || maxLossPercent <= 0) return 0;
  return maxLossPercent / 100;
}

function latestDrawdownFraction(drawdownHistory: DrawdownPoint[]): number | null {
  if (!drawdownHistory?.length) return null;

  const latest = drawdownHistory[drawdownHistory.length - 1];
  if (!Number.isFinite(latest.drawdownPercent) || latest.drawdownPercent < 0) {
    return null;
  }

  return latest.drawdownPercent;
}

function computeDrawdownExposurePercent(
  drawdownFraction: number,
  maxLossPercent: number,
): number {
  const drawdownPercent = drawdownFraction * 100;
  return Math.min(100, Math.max(0, (drawdownPercent / maxLossPercent) * 100));
}

function computeVolatilityExposurePercent(
  values: number[],
  protocolMaxLossPercentCeiling: number,
): number | null {
  if (values.length < 2) return null;

  const returns: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const previous = values[i - 1];
    const current = values[i];
    if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current)) {
      continue;
    }
    returns.push(Math.abs((current - previous) / previous));
  }

  if (returns.length === 0) return null;

  const meanAbsReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const scale = (VOLATILITY_RETURN_SCALE * 100) / protocolMaxLossPercentCeiling;
  return Math.min(100, Math.max(0, meanAbsReturn * 100 * scale));
}

function combineExposure(
  drawdownExposure: number | null,
  volatilityExposure: number | null,
): number | null {
  if (drawdownExposure !== null && volatilityExposure !== null) {
    return (
      DRAWDOWN_WEIGHT * drawdownExposure + VOLATILITY_WEIGHT * volatilityExposure
    );
  }
  if (drawdownExposure !== null) return drawdownExposure;
  if (volatilityExposure !== null) return volatilityExposure;
  return null;
}

export function computeCommitmentExposure(
  input: CommitmentExposureInput,
  commitmentLimits?: Pick<CommitmentLimits, 'maxLossPercentCeiling'>,
): CommitmentExposureResult {
  const zoneThresholds = EXPOSURE_ZONE_THRESHOLDS;
  const ceiling =
    input.protocolMaxLossPercentCeiling ??
    commitmentLimits?.maxLossPercentCeiling ??
    DEFAULT_PROTOCOL_MAX_LOSS_CEILING;

  const drawdownThresholdPercent = computeDrawdownThresholdPercent(input.maxLossPercent);

  if (!Number.isFinite(input.maxLossPercent) || input.maxLossPercent <= 0) {
    return {
      status: 'insufficient_data',
      drawdownThresholdPercent,
      zoneThresholds,
    };
  }

  const drawdownFraction = input.drawdownHistory
    ? latestDrawdownFraction(input.drawdownHistory)
    : null;
  const drawdownExposure =
    drawdownFraction !== null
      ? computeDrawdownExposurePercent(drawdownFraction, input.maxLossPercent)
      : null;

  const values =
    input.valueHistory
      ?.map((point) => point.currentValue)
      .filter((value) => Number.isFinite(value)) ?? [];
  const volatilityExposure =
    values.length >= 2
      ? computeVolatilityExposurePercent(values, ceiling)
      : null;

  const exposurePercent = combineExposure(drawdownExposure, volatilityExposure);

  if (exposurePercent === null || !Number.isFinite(exposurePercent)) {
    return {
      status: 'insufficient_data',
      drawdownThresholdPercent,
      zoneThresholds,
    };
  }

  const rounded = Math.round(exposurePercent * 10) / 10;

  return {
    status: 'ok',
    exposurePercent: rounded,
    level: getExposureLevel(rounded, zoneThresholds),
    drawdownThresholdPercent,
    zoneThresholds,
  };
}
