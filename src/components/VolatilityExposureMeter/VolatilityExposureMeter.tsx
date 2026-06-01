'use client'

import { useState } from 'react'
import styles from './VolatilityExposureMeter.module.css'
import {
  clamp,
  getThresholdBand,
  BAND_LABELS,
  BAND_TOOLTIPS,
} from './thresholds'

export type { ThresholdBand } from './thresholds'
export {
  clamp,
  getThresholdBand,
  THRESHOLDS,
  BAND_LABELS,
  BAND_TOOLTIPS,
  RISK_PROFILE_BAND,
} from './thresholds'

export interface VolatilityExposureMeterProps {
  /** Current exposure as a percentage (0–100). Clamped when rendering. */
  valuePercent: number
  /** Optional short description of what the exposure means. */
  description?: string
}

export default function VolatilityExposureMeter({
  valuePercent,
  description,
}: VolatilityExposureMeterProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const percent = clamp(valuePercent)
  const band = getThresholdBand(percent)
  const bandLabel = BAND_LABELS[band]
  const tooltipText = BAND_TOOLTIPS[band]
  const ariaValueText = `${Math.round(percent)} percent, ${bandLabel} zone`

  return (
    <section
      className={styles.container}
      aria-labelledby="volatility-exposure-title"
      aria-describedby={description ? 'volatility-exposure-desc' : undefined}
    >
      <div className={styles.header}>
        <h2 id="volatility-exposure-title" className={styles.title}>
          Volatility Exposure
        </h2>
        <div className={styles.headerRight}>
          <span className={`${styles.bandBadge} ${styles[`band_${band}`]}`}>
            {bandLabel}
          </span>
          <span className={styles.percentLabel}>{Math.round(percent)}%</span>
        </div>
      </div>

      {/* Threshold band markers */}
      <div className={styles.thresholdBands} aria-hidden="true">
        <div className={`${styles.band} ${styles.bandSafe}`} />
        <div className={`${styles.band} ${styles.bandCaution}`} />
        <div className={`${styles.band} ${styles.bandDanger}`} />
      </div>

      <div
        className={styles.barTrack}
        role="meter"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Volatility Exposure meter"
        aria-valuetext={ariaValueText}
      >
        <div
          className={styles.barMask}
          style={{ width: `${percent}%` }}
        >
          <div className={styles.barGradient} />
        </div>
      </div>

      <div className={styles.labelsRow}>
        <span>Low (Safe)</span>
        <span>Medium (Caution)</span>
        <span>High (Danger)</span>
      </div>

      {/* Tooltip trigger */}
      <div className={styles.tooltipWrapper}>
        <button
          type="button"
          className={styles.tooltipTrigger}
          aria-label={`What does ${bandLabel} exposure mean?`}
          aria-expanded={tooltipVisible}
          aria-controls="volatility-tooltip"
          onClick={() => setTooltipVisible((v) => !v)}
          onBlur={() => setTooltipVisible(false)}
        >
          <span aria-hidden="true">ⓘ</span>
          <span className={styles.srOnly}>Exposure zone info</span>
        </button>
        {tooltipVisible && (
          <div
            id="volatility-tooltip"
            role="tooltip"
            className={styles.tooltip}
          >
            {tooltipText}
          </div>
        )}
      </div>

      {description && (
        <p id="volatility-exposure-desc" className={styles.description}>
          {description}
        </p>
      )}
    </section>
  )
}
