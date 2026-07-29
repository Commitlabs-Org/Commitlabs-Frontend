import { describe, it, expect } from 'vitest';
import {
  computeCommitmentExposure,
  computeDrawdownThresholdPercent,
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
    expect(computeDrawdownThresholdPercent(8)).toBeCloseTo(0.08);
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

  it('guards against a zero protocolMaxLossPercentCeiling instead of producing NaN/Infinity', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      drawdownHistory,
      maxLossPercent: 8,
      protocolMaxLossPercentCeiling: 0,
    });

    // Drawdown-based exposure still applies even though the volatility
    // leg is dropped for an invalid ceiling — the result must stay a
    // finite, valid percent rather than NaN/Infinity.
    expect(result.status).toBe('ok');
    expect(Number.isFinite(result.exposurePercent)).toBe(true);
  });

  it('guards against a negative protocolMaxLossPercentCeiling instead of producing NaN/Infinity', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      drawdownHistory,
      maxLossPercent: 8,
      protocolMaxLossPercentCeiling: -10,
    });

    expect(result.status).toBe('ok');
    expect(Number.isFinite(result.exposurePercent)).toBe(true);
  });
});
