/**
 * Threshold zone logic for VolatilityExposureMeter.
 * Exported separately so pure-logic tests can import without JSX.
 */

/** Threshold band boundaries aligned with RiskProfile tiers. */
export const THRESHOLDS = {
  SAFE_MAX: 33,
  CAUTION_MAX: 66,
} as const

export type ThresholdBand = 'safe' | 'caution' | 'danger'

/** Maps CommitmentType tiers to threshold bands. */
export const RISK_PROFILE_BAND: Record<string, ThresholdBand> = {
  Safe: 'safe',
  Balanced: 'caution',
  Aggressive: 'danger',
}

export const BAND_LABELS: Record<ThresholdBand, string> = {
  safe: 'Safe',
  caution: 'Caution',
  danger: 'Danger',
}

export const BAND_TOOLTIPS: Record<ThresholdBand, string> = {
  safe:
    'Exposure is within the Safe tier (0–33%). Aligns with a Safe commitment profile.',
  caution:
    'Exposure is in the Caution tier (34–66%). Aligns with a Balanced commitment profile.',
  danger:
    'Exposure is in the Danger tier (67–100%). Aligns with an Aggressive commitment profile.',
}

export function clamp(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function getThresholdBand(percent: number): ThresholdBand {
  if (percent <= THRESHOLDS.SAFE_MAX) return 'safe'
  if (percent <= THRESHOLDS.CAUTION_MAX) return 'caution'
  return 'danger'
}
