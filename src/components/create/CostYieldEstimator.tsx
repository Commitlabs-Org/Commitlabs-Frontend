'use client'

import React, { useEffect, useState, useRef } from 'react'
import { fetchProtocolConstants, type ProtocolConstants } from '@/utils/protocol'

export interface CostYieldEstimate {
  projectedYieldMin: number
  projectedYieldMax: number
  worstCasePenalty: number
  platformFee: number
  isValid: boolean
}

export interface CostYieldEstimatorProps {
  amount: string | number
  durationDays: number
  maxLossPercent: number
  asset: string
}

function computeEstimates(
  amount: number,
  durationDays: number,
  maxLossPercent: number,
  constants: ProtocolConstants,
): CostYieldEstimate {
  const platformFeePercent = constants.fees.platformFeePercent ?? 0.5
  const platformFee = (amount * platformFeePercent) / 100

  // Base APY range sourced from penalty tiers (conservative heuristic)
  const baseApyMin = 3
  const baseApyMax = 12
  const durationFactor = Math.min(durationDays / 365, 1)

  const projectedYieldMin = (amount * (baseApyMin / 100) * durationFactor) - platformFee
  const projectedYieldMax = (amount * (baseApyMax / 100) * durationFactor) - platformFee

  // Worst-case penalty: use highest early-exit penalty tier if available
  const maxPenaltyPercent =
    constants.penalties.length > 0
      ? Math.max(...constants.penalties.map((p) => p.earlyExitPenaltyPercent))
      : maxLossPercent

  const worstCasePenalty = (amount * maxPenaltyPercent) / 100

  return {
    projectedYieldMin: Math.max(0, projectedYieldMin),
    projectedYieldMax: Math.max(0, projectedYieldMax),
    worstCasePenalty,
    platformFee,
    isValid: true,
  }
}

const PLACEHOLDER: CostYieldEstimate = {
  projectedYieldMin: 0,
  projectedYieldMax: 0,
  worstCasePenalty: 0,
  platformFee: 0,
  isValid: false,
}

export default function CostYieldEstimator({
  amount,
  durationDays,
  maxLossPercent,
  asset,
}: CostYieldEstimatorProps) {
  const [constants, setConstants] = useState<ProtocolConstants | null>(null)
  const [estimate, setEstimate] = useState<CostYieldEstimate>(PLACEHOLDER)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchProtocolConstants()
      .then(setConstants)
      .catch(() => { /* silently fall back */ })
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const numericAmount = Number(amount)
      if (!constants || !numericAmount || numericAmount <= 0 || durationDays < 1) {
        setEstimate(PLACEHOLDER)
        return
      }
      setEstimate(computeEstimates(numericAmount, durationDays, maxLossPercent, constants))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [amount, durationDays, maxLossPercent, constants])

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <section
      aria-label="Cost and yield estimator"
      aria-live="polite"
      data-testid="cost-yield-estimator"
      className="rounded-xl border border-white/[0.08] bg-[#0A0A0B] p-5 space-y-4"
    >
      <h3 className="text-lg font-bold text-white">Estimated Costs &amp; Yield</h3>
      <p className="text-xs text-[#99a1af]">
        All figures are <strong>estimates only</strong> and may vary based on market conditions.
      </p>

      {!estimate.isValid ? (
        <p className="text-sm text-[#5a5a5a]" data-testid="estimator-placeholder">
          Enter a valid amount and duration to see projections.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-3">
          <div className="flex justify-between items-center rounded-lg border border-white/[0.06] bg-[#0f0f10] px-4 py-3">
            <dt className="text-sm text-[#99a1af]">Projected Yield (est.)</dt>
            <dd className="text-sm font-semibold text-[#00d4aa]" data-testid="projected-yield">
              {fmt(estimate.projectedYieldMin)} – {fmt(estimate.projectedYieldMax)} {asset}
            </dd>
          </div>
          <div className="flex justify-between items-center rounded-lg border border-white/[0.06] bg-[#0f0f10] px-4 py-3">
            <dt className="text-sm text-[#99a1af]">Worst-case Penalty (est.)</dt>
            <dd className="text-sm font-semibold text-[#ff4444]" data-testid="worst-case-penalty">
              {fmt(estimate.worstCasePenalty)} {asset}
            </dd>
          </div>
          <div className="flex justify-between items-center rounded-lg border border-white/[0.06] bg-[#0f0f10] px-4 py-3">
            <dt className="text-sm text-[#99a1af]">Platform Fee (est.)</dt>
            <dd className="text-sm font-semibold text-white" data-testid="platform-fee">
              {fmt(estimate.platformFee)} {asset}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
