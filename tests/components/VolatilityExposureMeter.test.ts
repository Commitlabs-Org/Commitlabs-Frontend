import { describe, it, expect } from 'vitest'
import {
  clamp,
  getThresholdBand,
  THRESHOLDS,
  BAND_LABELS,
  BAND_TOOLTIPS,
  RISK_PROFILE_BAND,
} from '@/components/VolatilityExposureMeter/thresholds'

describe('clamp', () => {
  it('returns 0 for NaN', () => {
    expect(clamp(NaN)).toBe(0)
  })

  it('returns 0 for non-number', () => {
    expect(clamp('abc' as unknown as number)).toBe(0)
  })

  it('clamps negative values to 0', () => {
    expect(clamp(-10)).toBe(0)
  })

  it('clamps values above 100 to 100', () => {
    expect(clamp(150)).toBe(100)
  })

  it('passes through values within range', () => {
    expect(clamp(0)).toBe(0)
    expect(clamp(50)).toBe(50)
    expect(clamp(100)).toBe(100)
  })
})

describe('getThresholdBand', () => {
  it('returns "safe" for 0', () => {
    expect(getThresholdBand(0)).toBe('safe')
  })

  it('returns "safe" at the safe boundary (33)', () => {
    expect(getThresholdBand(THRESHOLDS.SAFE_MAX)).toBe('safe')
  })

  it('returns "caution" just above the safe boundary (34)', () => {
    expect(getThresholdBand(34)).toBe('caution')
  })

  it('returns "caution" at the caution boundary (66)', () => {
    expect(getThresholdBand(THRESHOLDS.CAUTION_MAX)).toBe('caution')
  })

  it('returns "danger" just above the caution boundary (67)', () => {
    expect(getThresholdBand(67)).toBe('danger')
  })

  it('returns "danger" at 100', () => {
    expect(getThresholdBand(100)).toBe('danger')
  })

  it('returns "safe" for mid-safe range (16)', () => {
    expect(getThresholdBand(16)).toBe('safe')
  })

  it('returns "caution" for mid-caution range (50)', () => {
    expect(getThresholdBand(50)).toBe('caution')
  })

  it('returns "danger" for mid-danger range (85)', () => {
    expect(getThresholdBand(85)).toBe('danger')
  })
})

describe('BAND_LABELS', () => {
  it('has a label for each band', () => {
    expect(BAND_LABELS.safe).toBe('Safe')
    expect(BAND_LABELS.caution).toBe('Caution')
    expect(BAND_LABELS.danger).toBe('Danger')
  })
})

describe('BAND_TOOLTIPS', () => {
  it('has a tooltip for each band', () => {
    expect(BAND_TOOLTIPS.safe).toContain('Safe tier')
    expect(BAND_TOOLTIPS.caution).toContain('Caution tier')
    expect(BAND_TOOLTIPS.danger).toContain('Danger tier')
  })

  it('safe tooltip mentions 0–33%', () => {
    expect(BAND_TOOLTIPS.safe).toContain('0–33%')
  })

  it('caution tooltip mentions 34–66%', () => {
    expect(BAND_TOOLTIPS.caution).toContain('34–66%')
  })

  it('danger tooltip mentions 67–100%', () => {
    expect(BAND_TOOLTIPS.danger).toContain('67–100%')
  })
})

describe('RISK_PROFILE_BAND alignment', () => {
  it('maps Safe commitment type to safe band', () => {
    expect(RISK_PROFILE_BAND['Safe']).toBe('safe')
  })

  it('maps Balanced commitment type to caution band', () => {
    expect(RISK_PROFILE_BAND['Balanced']).toBe('caution')
  })

  it('maps Aggressive commitment type to danger band', () => {
    expect(RISK_PROFILE_BAND['Aggressive']).toBe('danger')
  })
})

describe('threshold boundary consistency', () => {
  it('safe band covers 0 to SAFE_MAX inclusive', () => {
    for (let i = 0; i <= THRESHOLDS.SAFE_MAX; i++) {
      expect(getThresholdBand(i)).toBe('safe')
    }
  })

  it('caution band covers SAFE_MAX+1 to CAUTION_MAX inclusive', () => {
    for (let i = THRESHOLDS.SAFE_MAX + 1; i <= THRESHOLDS.CAUTION_MAX; i++) {
      expect(getThresholdBand(i)).toBe('caution')
    }
  })

  it('danger band covers CAUTION_MAX+1 to 100 inclusive', () => {
    for (let i = THRESHOLDS.CAUTION_MAX + 1; i <= 100; i++) {
      expect(getThresholdBand(i)).toBe('danger')
    }
  })
})
