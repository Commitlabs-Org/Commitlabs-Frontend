import { describe, it, expect } from 'vitest';
import {
  computeCommitmentExposure,
  computeDrawdownThresholdPercent,
  computeVolatilityExposurePercent,
  getExposureLevel,
  EXPOSURE_ZONE_THRESHOLDS,
  type ValueHistoryPoint,
  type DrawdownPoint,
} from '../exposure';

describe('getExposureLevel', () => {
  it('classifies low/medium/high against the zone thresholds', () => {
    expect(getExposureLevel(0)).toBe('low');
    expect(getExposureLevel(EXPOSURE_ZONE_THRESHOLDS.lowMax)).toBe('low');
    expect(getExposureLevel(EXPOSURE_ZONE_THRESHOLDS.lowMax + 1)).toBe('medium');
    expect(getExposureLevel(EXPOSURE_ZONE_THRESHOLDS.mediumMax)).toBe('medium');
    expect(getExposureLevel(EXPOSURE_ZONE_THRESHOLDS.mediumMax + 1)).toBe('high');
    expect(getExposureLevel(100)).toBe('high');
  });
});

describe('computeDrawdownThresholdPercent', () => {
  it('converts a max-loss percent to a 0-1 fraction', () => {
    expect(computeDrawdownThresholdPercent(8)).toBeLoseTo(0.08);
  });

  it('guards against a zero/negative/non-finite maxLossPercent', () => {
    expect(computeDrawdownThresholdPercent(0)).toBe(0);
    expect(computeDrawdownThresholdPercent(-5)).toBe(0);
    expect(computeDrawdownThresholdPercent(NaN)).toBe(0);
  });
});

describe('computeCommitmentExposure', () => {
  const valueHistory: ValueHistoryPoint[] = [
    { date: 'Jan 10', currentValue: 50000, initialAmount: 50000 },
    { date: 'Jan 15', currentValue: 52000, initialAmount: 50000 },
    { date: 'Jan 20', currentValue: 51500, initialAmount: 50000 },
    { date: 'Jan 25', currentValue: 53000, initialAmount: 50000 },
    { date: 'Jan 28', currentValue: 54000, initialAmount: 50000 },
  ];

  const drawdownHistory: DrawdownPoint[] = [
    { date: 'Jan 10', drawdownPercent: 0 },
    { date: 'Jan 15', drawdownPercent: 0.35 },
    { date: 'Jan 20', drawdownPercent: 0.58 },
    { date: 'Jan 25', drawdownPercent: 0.52 },
    { date: 'Jan 28', drawdownPercent: 0.78 },
  ];

  it('computes exposure from history data', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      drawdownHistory,
      maxLossPercent: 8,
    });

    expect(result.status).toBe('ok');
    expect(result.exposurePercent).toBeGreaterThanOrEqual(0);
    expect(result.exposurePercent).toBeLessThanOrEqual(100);
    expect(result.level).toBeDefined();
    expect(result.drawdownThresholdPercent).toBeCloseTo(0.08);
    expect(result.zoneThresholds).toEqual(EXPOSURE_ZONE_THRESHOLDS);
  });

  it('handles empty history gracefully', () => {
    const result = computeCommitmentExposure({
      valueHistory: [],
      drawdownHistory: [],
      maxLossPercent: 8,
    });

    expect(result.status).toBe('insufficient_data');
    expect(result.exposurePercent).toBeUndefined();
  });

  it('guards against a zero maxLossPercent — insufficient_data', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      drawdownHistory,
      maxLossPercent: 0,
    });

    expect(result.status).toBe('insufficient_data');
  });

  it('treats a zero protocolMaxLossPercentCeiling as insufficient_data', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      drawdownHistory,
      maxLossPercent: 8,
      protocolMaxLossPercentCeiling: 0,
    });

    expect(result.status).toBe('insufficient_data');
    expect(result.exposurePercent).toBeUndefined();
  });

  it('treats a negative protocolMaxLossPercentCeiling as insufficient_data', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      drawdownHistory,
      maxLossPercent: 8,
      protocolMaxLossPercentCeiling: -10,
    });

    expect(result.status).toBe('insufficient_data');
    expect(result.exposurePercent).toBeUndefined();
  });

  it('treats a zero commitmentLimits.maxLossPercentCeiling as insufficient_data', () => {
    const result = computeCommitmentExposure(
      {
        valueHistory,
        drawdownHistory,
        maxLossPercent: 8,
      },
      { maxLossPercentCeiling: 0 },
    );

    expect(result.status).toBe('insufficient_data');
    expect(result.exposurePercent).toBeUndefined();
  });

  it('returns insufficient_data when protocolMaxLossPercentCeiling is zero and only valueHistory is available', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      maxLossPercent: 8,
      protocolMaxLossPercentCeiling: 0,
    });

    expect(result.status).toBe('insufficient_data');
    expect(result.exposurePercent).toBeUndefined();
  });

  it('returns insufficient_data when protocolMaxLossPercentCeiling is negative and only valueHistory is available', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      maxLossPercent: 8,
      protocolMaxLossPercentCeiling: -10,
    });

    expect(result.status).toBe('insufficient_data');
    expect(result.exposurePercent).toBeUndefined();
  });

  it('returns insufficient_data when protocolMaxLossPercentCeiling is zero and drawdownHistory is empty', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      drawdownHistory: [],
      maxLossPercent: 8,
      protocolMaxLossPercentCeiling: 0,
    });

    expect(result.status).toBe('insufficient_data');
    expect(result.exposurePercent).toBeUndefined();
  });
});

describe('computeVolatilityExposurePercent', () => {
  const values = [50000, 52000, 51500, 53000, 54000];

  it('computes a valid exposure percentage for a positive ceiling', () => {
    const result = computeVolatilityExposurePercent(values, 100);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('guards against a zero ceiling and returns null instead of 100% exposure', () => {
    const result = computeVolatilityExposurePercent(values, 0);
    expect(result).toBeNull();
  });

  it('guards against a negative ceiling and returns null instead of 100% exposure', () => {
    const result = computeVolatilityExposurePercent(values, -15);
    expect(result).toBeNull();
  });

  it('guards against non-finite ceiling values and returns null', () => {
    expect(computeVolatilityExposurePercent(values, NaN)).toBeNull();
    expect(computeVolatilityExposurePercent(values, Infinity)).toBeNull();
    expect(computeVolatilityExposurePercent(values, -Infinity)).toBeNull();
  });

  it('returns null when values array has fewer than two elements', () => {
    expect(computeVolatilityExposurePercent([], 100)).toBeNull();
    expect(computeVolatilityExposurePercent([50000], 100)).toBeNull();
  });

  it('returns null when values do not yield valid positive returns', () => {
    expect(computeVolatilityExposurePercent([0, 0], 100)).toBeNull();
    expect(computeVolatilityExposurePercent([-10, -20], 100)).toBeNull();
  });

  it('clamps exposure to 100 for extreme volatility', () => {
    const volatileValues = [1000, 100000, 1000, 100000];
    const result = computeVolatilityExposurePercent(volatileValues, 1);
    expect(result).toBe(100);
  });

  it('supports scalar meanAbsReturn and calculates exposure for positive ceiling', () => {
    const result = computeVolatilityExposurePercent(0.05, 10);
    expect(result.percent).toBeGreaterThan(0);
    expect(result.percent).toBeLessThanOrEqual(100);
    expect(result.insufficientData).toBe(false);
  });

  it('supports scalar meanAbsReturn and flags insufficientData for zero ceiling', () => {
    const result = computeVolatilityExposurePercent(0.05, 0);
    expect(result.percent).toBe(0);
    expect(result.insufficientData).toBe(true);
  });

  it('supports scalar meanAbsReturn and flags insufficientData for negative ceiling', () => {
    const result = computeVolatilityExposurePercent(0.05, -10);
    expect(result.percent).toBe(0);
    expect(result.insufficientData).toBe(true);
  });

  it('supports scalar meanAbsReturn and flags insufficientData for non-finite values', () => {
    expect(computeVolatilityExposurePercent(0.05, NaN).insufficientData).toBe(true);
    expect(computeVolatilityExposurePercent(NaN, 10).insufficientData).toBe(true);
    expect(computeVolatilityExposurePercent(-0.5, 10).insufficientData).toBe(true);
  });
});
