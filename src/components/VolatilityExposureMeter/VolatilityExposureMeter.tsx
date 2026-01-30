'use client'

import styles from './VolatilityExposureMeter.module.css'

export interface VolatilityExposureMeterProps {
  /** Current exposure as a percentage (0–100). Clamped when rendering. */
  valuePercent: number
  /** Optional short description of what the exposure means. */
  description?: string
}

function clamp(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function exposureLevel(percent: number): 'low' | 'medium' | 'high' {
  if (percent <= 33) return 'low'
  if (percent <= 66) return 'medium'
  return 'high'
}

export default function VolatilityExposureMeter({
  valuePercent,
  description,
}: VolatilityExposureMeterProps) {
  const percent = clamp(valuePercent)
  const level = exposureLevel(percent)
  const ariaLabel = `Volatility exposure: ${percent}%, ${level} range.`

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
        <span className={styles.percentLabel}>{Math.round(percent)}%</span>
      </div>

      <div
        className={styles.barTrack}
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
        aria-valuetext={`${percent} percent, ${level}`}
      >
        <div
          className={styles.barMask}
          style={{ width: `${percent}%` }}
        >
             <div className={styles.barGradient} />
        </div>
      </div>

      <div className={styles.labelsRow}>
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>

      {description && (
        <p id="volatility-exposure-desc" className={styles.description}>
          {description}
        </p>
      )}
    </section>
  )
}
