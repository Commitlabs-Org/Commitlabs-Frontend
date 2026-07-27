import { describe, it, expect } from 'vitest';
import {
  computeVolatilityExposurePercent,
  computeCommitmentExposure,
  type ValueHistoryItem,
  type DrawdownHistoryItem,
} from '../exposure';

describe('computeVolatilityExposurePercent', () => {
  it('returns a finite percent for a positive ceiling', () => {
    const result = computeVolatilityExposurePercent(0.5, 10)
    expect(result.percent).toBeGreaterThanOrEqual(0)
    expect(result.percent).toBeLessThanOrEqual(100)
    expect(result.insufficientData).toBe(false)
  })

  it('returns 100% when meanAbsReturn is very large', () => {
    const result = computeVolatilityExposurePercent(100, 1)
    expect(result.percent).toBe(100)
    expect(result.insufficientData).toBe(false)
  })

  it('returns 0% when meanAbsReturn is 0', () => {
    const result = computeVolatilityExposurePercent(0, 10)
    expect(result.percent).toBe(0)
    expect(result.insufficientData).toBe(false)
  })

  it('guards against a zero ceiling — returns insufficientData', () => {
    const result = computeVolatilityExposurePercent(0.5, 0)
    expect(result.percent).toBe(0)
    expect(result.insufficientData).toBe(true)
  })

  it('guards against a negative ceiling — returns insufficientData', () => {
    const result = computeVolatilityExposurePercent(0.5, -5)
    expect(result.percent).toBe(0)
    expect(result.insufficientData).toBe(true)
  })
})

describe('computeCommitmentExposure', () => {
  const valueHistory: ValueHistoryItem[] = [
    { date: 'Jan 10', currentValue: 50000, initialAmount: 50000 },
    { date: 'Jan 15', currentValue: 52000, initialAmount: 50000 },
    { date: 'Jan 20', currentValue: 51500, initialAmount: 50000 },
    { date: 'Jan 25', currentValue: 53000, initialAmount: 50000 },
    { date: 'Jan 28', currentValue: 54000, initialAmount: 50000 },
  ]

  const drawdownHistory: DrawdownHistoryItem[] = [
    { date: 'Jan 10', drawdownPercent: 0 },
    { date: 'Jan 15', drawdownPercent: 0.35 },
    { date: 'Jan 20', drawdownPercent: 0.58 },
    { date: 'Jan 25', drawdownPercent: 0.52 },
    { date: 'Jan 28', drawdownPercent: 0.78 },
  ]

  it('computes exposure from history data', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      drawdownHistory,
      maxLossPercent: 8,
    })

    expect(result.currentDrawdownPercent).toBe(0.78)
    expect(result.meanAbsReturn).toBeGreaterThan(0)
    expect(result.volatilityExposurePercent).toBeGreaterThanOrEqual(0)
    expect(result.volatilityExposurePercent).toBeLessThanOrEqual(100)
    expect(result.insufficientData).toBe(false)
  })

  it('uses the most recent drawdown as currentDrawdownPercent', () => {
    const result = computeCommitmentExposure({
      valueHistory: [{ date: 'Jan 1', currentValue: 100, initialAmount: 100 }],
      drawdownHistory: [
        { date: 'Jan 1', drawdownPercent: 1 },
        { date: 'Jan 2', drawdownPercent: 2 },
      ],
      maxLossPercent: 10,
    })

    expect(result.currentDrawdownPercent).toBe(2)
  })

  it('handles empty history gracefully', () => {
    const result = computeCommitmentExposure({
      valueHistory: [],
      drawdownHistory: [],
      maxLossPercent: 8,
    })

    expect(result.currentDrawdownPercent).toBe(0)
    expect(result.meanAbsReturn).toBe(0)
    expect(result.volatilityExposurePercent).toBe(0)
  })

  it('guards against a zero maxLossPercent — insufficientData', () => {
    const result = computeCommitmentExposure({
      valueHistory,
      drawdownHistory,
      maxLossPercent: 0,
    })

    expect(result.insufficientData).toBe(true)
    expect(result.volatilityExposurePercent).toBe(0)
  })
})
