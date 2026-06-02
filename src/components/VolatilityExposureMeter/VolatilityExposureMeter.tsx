'use client'

import { useId } from 'react'
import styles from './VolatilityExposureMeter.module.css'

// ── Types ───────────────────────────────────────────────────────────────────

export type RiskProfileId = 'conservative' | 'balanced' | 'aggressive'

export type ThresholdZone = 'safe' | 'caution' | 'danger'

export interface ThresholdZoneConfig {
  id: ThresholdZone
  label: string
  rangeMin: number
  rangeMax: number
  /** Brief plain‑text description shown on‑screen */
  annotation: string
  /** Longer description used in tooltip / aria‑description */
  tooltip: string
}

export const THRESHOLD_ZONES: ThresholdZoneConfig[] = [
  {
    id: 'safe',
    label: 'Safe',
    rangeMin: 0,
    rangeMax: 33,
    annotation: 'Low exposure — within conservative risk profile.',
    tooltip:
      'Your portfolio is in the safe zone. This aligns with a Conservative risk profile where capital preservation is the primary goal. No immediate action needed.',
  },
  {
    id: 'caution',
    label: 'Caution',
    rangeMin: 33,
    rangeMax: 66,
    annotation: 'Moderate exposure — within balanced risk profile.',
    tooltip:
      'Your portfolio is in the caution zone. This aligns with a Balanced risk profile. Moderate drawdowns are expected. Consider reviewing your asset allocation.',
  },
  {
    id: 'danger',
    label: 'Danger',
    rangeMin: 66,
    rangeMax: 100,
    annotation: 'High exposure — within aggressive risk profile.',
    tooltip:
      'Your portfolio is in the danger zone. This aligns with an Aggressive risk profile with high loss tolerance. Volatility is elevated; monitor positions closely.',
  },
]

export const RISK_PROFILE_LABELS: Record<RiskProfileId, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function clamp(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function getThresholdZone(percent: number): ThresholdZoneConfig {
  const clamped = clamp(percent)
  if (clamped <= 33) return THRESHOLD_ZONES[0]
  if (clamped <= 66) return THRESHOLD_ZONES[1]
  return THRESHOLD_ZONES[2]
}

export function getExposureLevel(percent: number): 'low' | 'medium' | 'high' {
  const clamped = clamp(percent)
  if (clamped <= 33) return 'low'
  if (clamped <= 66) return 'medium'
  return 'high'
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface VolatilityExposureMeterProps {
  /** Current exposure as a percentage (0–100). Clamped when rendering. */
  valuePercent: number
  /** Optional short description of what the exposure means. */
  description?: string
  /**
   * Optional risk‑profile identifier.
   * When provided, the matching threshold zone is highlighted and a
   * "your risk profile" indicator is shown alongside the meter.
   */
  riskProfileId?: RiskProfileId
}

// ── Component ───────────────────────────────────────────────────────────────

export default function VolatilityExposureMeter({
  valuePercent,
  description,
  riskProfileId,
}: VolatilityExposureMeterProps) {
  const titleId = useId()
  const descId = useId()

  const percent = clamp(valuePercent)
  const zone = getThresholdZone(percent)
  const level = getExposureLevel(percent)
  const riskProfileLabel = riskProfileId
    ? RISK_PROFILE_LABELS[riskProfileId]
    : undefined

  const ariaValueText = `${percent} percent, ${zone.label.toLowerCase()} zone — ${zone.annotation}`

  return (
    <section
      className={styles.container}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <h2 id={titleId} className={styles.title}>
            Volatility Exposure
          </h2>
          {riskProfileLabel && (
            <span className={styles.riskBadge} aria-label={`Risk profile: ${riskProfileLabel}`}>
              {riskProfileLabel}
            </span>
          )}
        </div>
        <span className={styles.percentLabel} aria-hidden="true">
          {Math.round(percent)}%
        </span>
      </div>

      {/* ── Meter bar with background zone bands ────────────────── */}
      <div
        className={styles.meterContainer}
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Volatility exposure: ${percent}%, ${zone.label.toLowerCase()} range.`}
        aria-valuetext={ariaValueText}
      >
        {/* Background zone bands */}
        <div className={styles.barTrack} aria-hidden="true">
          {THRESHOLD_ZONES.map((z) => (
            <span
              key={z.id}
              className={`${styles.zoneBand} ${styles[`zone${z.id.charAt(0).toUpperCase() + z.id.slice(1)}`]}`}
              style={{
                left: `${z.rangeMin}%`,
                width: `${z.rangeMax - z.rangeMin}%`,
              }}
            />
          ))}
        </div>

        {/* Foreground fill mask */}
        <div
          className={styles.barMask}
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        >
          <div className={styles.barGradient} />
        </div>
      </div>

      {/* ── Zone labels row ─────────────────────────────────────── */}
      <div className={styles.labelsRow} role="list" aria-label="Exposure threshold zones">
        {THRESHOLD_ZONES.map((z) => {
          const isActive = z.id === zone.id
          return (
            <span
              key={z.id}
              role="listitem"
              className={`${styles.zoneLabel} ${isActive ? styles.zoneLabelActive : ''} ${styles[`zoneLabel${z.id.charAt(0).toUpperCase() + z.id.slice(1)}`]}`}
              title={isActive ? z.tooltip : `${z.label}: ${z.annotation}`}
              aria-current={isActive ? 'true' : undefined}
            >
              {z.label}
            </span>
          )
        })}
      </div>

      {/* ── Active zone annotation (always visible text) ─────────── */}
      <div
        className={styles.annotationBox}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className={styles.annotationIcon} aria-hidden="true">
          {zone.id === 'safe' && '\u2705'}
          {zone.id === 'caution' && '\u26A0\uFE0F'}
          {zone.id === 'danger' && '\u274C'}
        </span>
        <span className={styles.annotationText}>{zone.annotation}</span>
        <span
          className={styles.tooltipTrigger}
          tabIndex={0}
          role="tooltip"
          aria-label={zone.tooltip}
          title={zone.tooltip}
        >
          &#9432;
        </span>
      </div>

      {/* ── Optional description ────────────────────────────────── */}
      {description && (
        <p id={descId} className={styles.description} aria-label={description}>
          {description}
        </p>
      )}
    </section>
  )
}
