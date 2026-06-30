'use client'

import {
  EXPOSURE_ZONE_THRESHOLDS,
  getExposureLevel,
  type ExposureLevel,
} from '@/utils/exposure'
import styles from './VolatilityExposureMeter.module.css'
import { useReducedMotion } from '@/lib/a11y/useReducedMotion'

export interface VolatilityExposureMeterProps {
  /** Current exposure as a percentage (0–100). Clamped when rendering. */
  valuePercent?: number
  /** When true, shows an explicit insufficient-data state instead of a numeric reading. */
  insufficientData?: boolean
  /** Optional short description of what the exposure means. */
  description?: string
  /**
   * Historical exposure values (0–100 each) shown as a mini sparkline trend.
   * Should be ordered oldest → newest; at least 2 values required to render.
   */
  historyData?: number[]
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

interface SparklineProps {
  data: number[]
}

function TrendSparkline({ data }: SparklineProps) {
  const W = 80
  const H = 24
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W
      const y = H - ((v - min) / range) * H
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const trend = data[data.length - 1] >= data[0]
  const stroke = trend ? '#ef4444' : '#22c55e' // higher volatility = red; lower = green
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function VolatilityExposureMeter({
  valuePercent = 0,
  insufficientData = false,
  description,
  historyData,
}: VolatilityExposureMeterProps) {
  const percent = clamp(valuePercent)
  const level = exposureLevel(percent)
  const ariaLabel = `Volatility exposure: ${percent}%, ${level} range.`
  const reducedMotion = useReducedMotion()
  const hasHistory = historyData && historyData.length >= 2

  return (
    <section
      className={styles.container}
      aria-labelledby="volatility-exposure-title"
      aria-describedby={
        description || insufficientData ? 'volatility-exposure-desc' : undefined
      }
    >
      <div className={styles.header}>
        <h2 id="volatility-exposure-title" className={styles.title}>
          Volatility Exposure
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {hasHistory && !reducedMotion && (
            <TrendSparkline data={historyData!} />
          )}
          <span className={styles.percentLabel}>{Math.round(percent)}%</span>
        </div>
      </div>

      <div
        className={styles.barTrack}
        role="meter"
        aria-valuenow={insufficientData ? undefined : percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
        aria-valuetext={valueText}
      >
        <div
          className={styles.barMask}
          style={{
            width: `${percent}%`,
            transition: reducedMotion ? 'none' : undefined,
          }}
        >
          <div className={styles.barGradient} />
        </div>
      </div>

      <div className={styles.labelsRow}>
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>

      {insufficientData && (
        <p id="volatility-exposure-desc" className={styles.description}>
          Insufficient data — not enough value history or drawdown metrics to compute exposure.
        </p>
      )}

      {!insufficientData && description && (
        <p id="volatility-exposure-desc" className={styles.description}>
          {description}
        </p>
      )}
    </section>
  )
}
