import { describe, expect, it } from 'vitest';

import {
  EXPOSURE_ZONE_THRESHOLDS,
  computeCommitmentExposure,
  computeDrawdownThresholdPercent,
  getExposureLevel,
} from '../exposure';

describe('getExposureLevel', () => {
  it('classifies low, medium, and high zones', () => {
    expect(getExposureLevel(10)).toBe('low');
    expect(getExposureLevel(50)).toBe('medium');
    expect(getExposureLevel(90)).toBe('high');
  });

  it('handles boundary values between zones', () => {
    expect(getExposureLevel(33)).toBe('low');
    expect(getExposureLevel(34)).toBe('medium');
    expect(getExposureLevel(66)).toBe('medium');
    expect(getExposureLevel(67)).toBe('high');
  });
});

describe('computeDrawdownThresholdPercent', () => {
  it('converts max loss percent to a 0–1 chart threshold', () => {
    expect(computeDrawdownThresholdPercent(8)).toBe(0.08);
    expect(computeDrawdownThresholdPercent(50)).toBe(0.5);
  });
});

describe('computeCommitmentExposure', () => {
  it('returns insufficient_data when metrics are missing or invalid', () => {
    expect(
      computeCommitmentExposure({
        maxLossPercent: 8,
        valueHistory: [{ date: 'Jan 1', currentValue: 1000 }],
      }).status,
    ).toBe('insufficient_data');

    expect(
      computeCommitmentExposure({
        maxLossPercent: 0,
        drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.1 }],
      }).status,
    ).toBe('insufficient_data');

    expect(
      computeCommitmentExposure({
        maxLossPercent: 8,
      }).status,
    ).toBe('insufficient_data');
  });

  it('computes low exposure from drawdown-only data', () => {
    const result = computeCommitmentExposure({
      maxLossPercent: 10,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.02 }],
    });

    expect(result.status).toBe('ok');
    expect(result.exposurePercent).toBe(20);
    expect(result.level).toBe('low');
    expect(result.drawdownThresholdPercent).toBe(0.1);
    expect(result.zoneThresholds).toEqual(EXPOSURE_ZONE_THRESHOLDS);
  });

  it('computes medium exposure in the medium zone', () => {
    const result = computeCommitmentExposure({
      maxLossPercent: 8,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.05 }],
    });

    expect(result.status).toBe('ok');
    expect(result.exposurePercent).toBe(62.5);
    expect(result.level).toBe('medium');
  });

  it('computes high exposure when drawdown nears max loss', () => {
    const result = computeCommitmentExposure({
      maxLossPercent: 8,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.08 }],
    });

    expect(result.status).toBe('ok');
    expect(result.exposurePercent).toBe(100);
    expect(result.level).toBe('high');
  });

  it('handles boundary values between exposure zones (drawdown-only)', () => {
    const atLowBoundary = computeCommitmentExposure({
      maxLossPercent: 10,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.033 }],
    });
    expect(atLowBoundary.exposurePercent).toBe(33);
    expect(atLowBoundary.level).toBe('low');

    const atMediumLower = computeCommitmentExposure({
      maxLossPercent: 10,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.034 }],
    });
    expect(atMediumLower.exposurePercent).toBe(34);
    expect(atMediumLower.level).toBe('medium');

    const atMediumUpper = computeCommitmentExposure({
      maxLossPercent: 10,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.066 }],
    });
    expect(atMediumUpper.exposurePercent).toBe(66);
    expect(atMediumUpper.level).toBe('medium');

    const atHighLower = computeCommitmentExposure({
      maxLossPercent: 10,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.067 }],
    });
    expect(atHighLower.exposurePercent).toBe(67);
    expect(atHighLower.level).toBe('high');
  });

  it('computes exposure from value history volatility when drawdown is absent', () => {
    const lowVolatility = computeCommitmentExposure({
      maxLossPercent: 10,
      valueHistory: [
        { date: 'Jan 1', currentValue: 1000 },
        { date: 'Jan 2', currentValue: 1010 },
      ],
    });
    expect(lowVolatility.status).toBe('ok');
    expect(lowVolatility.level).toBe('low');

    const highVolatility = computeCommitmentExposure({
      maxLossPercent: 10,
      valueHistory: [
        { date: 'Jan 1', currentValue: 1000 },
        { date: 'Jan 2', currentValue: 1200 },
      ],
    });
    expect(highVolatility.status).toBe('ok');
    expect(highVolatility.level).toBe('high');
  });

  it('ignores invalid drawdown readings and falls back to value history', () => {
    const result = computeCommitmentExposure({
      maxLossPercent: 10,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: Number.NaN }],
      valueHistory: [
        { date: 'Jan 1', currentValue: 1000 },
        { date: 'Jan 2', currentValue: 1010 },
      ],
    });

    expect(result.status).toBe('ok');
    expect(result.level).toBe('low');
  });

  it('skips invalid value history points when computing volatility', () => {
    const result = computeCommitmentExposure({
      maxLossPercent: 10,
      valueHistory: [
        { date: 'Jan 1', currentValue: 0 },
        { date: 'Jan 2', currentValue: 1000 },
        { date: 'Jan 3', currentValue: Number.NaN },
        { date: 'Jan 4', currentValue: 1010 },
      ],
    });

    expect(result.status).toBe('ok');
    expect(result.exposurePercent).toBe(20);
  });

  it('returns zero drawdown threshold when max loss is invalid', () => {
    expect(computeDrawdownThresholdPercent(Number.NaN)).toBe(0);
  });

  it('combines drawdown and value history when both are available', () => {
    const result = computeCommitmentExposure({
      maxLossPercent: 10,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.02 }],
      valueHistory: [
        { date: 'Jan 1', currentValue: 1000 },
        { date: 'Jan 2', currentValue: 1050 },
      ],
    });

    expect(result.status).toBe('ok');
    expect(result.exposurePercent).toBe(52);
    expect(result.level).toBe('medium');
  });
});
