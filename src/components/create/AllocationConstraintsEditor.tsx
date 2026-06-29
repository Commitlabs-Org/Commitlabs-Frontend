'use client'

import React, { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { fetchProtocolConstants, type ProtocolConstants } from '@/utils/protocol'
import styles from './AllocationConstraintsEditor.module.css'

interface Constraint {
  id: string
  text: string
}

interface AllocationConstraintsEditorProps {
  maxLossPercent: number
  commitmentType: 'safe' | 'balanced' | 'aggressive'
  amount: string | number
  asset: string
  onChangeMaxLoss: (value: number) => void
}

export default function AllocationConstraintsEditor({
  maxLossPercent,
  commitmentType,
  amount,
  asset,
  onChangeMaxLoss,
}: AllocationConstraintsEditorProps) {
  const [constants, setConstants] = useState<ProtocolConstants | null>(null)

  useEffect(() => {
    fetchProtocolConstants()
      .then(setConstants)
      .catch(() => {
        /* Fall back to defaults silently */
      })
  }, [])

  const ceiling = constants?.commitmentLimits?.maxLossPercentCeiling ?? 100
  const numericAmount = Number(amount) || 0
  const maxLossValue = ((numericAmount * maxLossPercent) / 100).toFixed(2)

  const typeLabel =
    commitmentType === 'safe' ? 'Safe' :
    commitmentType === 'balanced' ? 'Balanced' :
    'Aggressive'

  const constraints: Constraint[] = [
    {
      id: 'max-loss',
      text: `Maximum acceptable loss: ${maxLossPercent}% (${maxLossValue} ${asset})`,
    },
    {
      id: 'type',
      text: `Commitment type: ${typeLabel}`,
    },
    {
      id: 'protocol-ceiling',
      text: `Protocol ceiling: ${ceiling}% max loss`,
    },
    {
      id: 'risk-level',
      text: getRiskDescription(maxLossPercent),
    },
  ]

  const gaugeColor =
    maxLossPercent <= 30 ? '#00d4aa' :
    maxLossPercent <= 70 ? '#f5a623' :
    '#ff4444'

  return (
    <section className="space-y-4 w-full" data-testid="allocation-editor">
      <h3 className="text-lg font-bold text-white">Allocation Constraints</h3>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={ceiling}
        aria-valuenow={maxLossPercent}
        aria-label="Max loss headroom gauge"
        className="rounded-xl border border-white/[0.08] bg-[#0f0f10] p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#99a1af]">Stop-loss threshold</span>
          <span className="text-sm font-semibold" style={{ color: gaugeColor }}>
            {maxLossPercent}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#1a1a1c] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(maxLossPercent / ceiling) * 100}%`,
              background: gaugeColor,
              boxShadow: `0 0 8px ${gaugeColor}40`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[11px] text-[#5a5a5a]">0%</span>
          <span className="text-[11px] text-[#5a5a5a]">Ceiling: {ceiling}%</span>
        </div>
      </div>

      <ul className="flex flex-col gap-2 p-0 m-0 list-none">
        {constraints.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0f0f10] px-5 py-3.5 transition-all duration-200 hover:bg-[#1a1a1c] hover:border-white/[0.12]"
          >
            <div className="h-2 w-2 shrink-0 rounded-full bg-[#0ff0fc] shadow-[0_0_8px_rgba(15,240,252,0.5)]" />
            <span className="text-[14px] text-[#e0e0e0] font-medium">{c.text}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0B] p-4">
        <label htmlFor="editor-maxloss-slider" className="block text-sm font-medium text-[#e0e0e0] mb-3">
          Adjust Max Loss
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            id="editor-maxloss-slider"
            className={styles.editorSlider}
            min="0"
            max={ceiling}
            value={maxLossPercent}
            onChange={(e) => onChangeMaxLoss(Number(e.target.value))}
            aria-label="Max loss percentage slider"
            style={{
              background: `linear-gradient(to right, ${gaugeColor} ${(maxLossPercent / ceiling) * 100}%, #2a2a2a ${(maxLossPercent / ceiling) * 100}%)`,
              '--slider-thumb-color': gaugeColor,
            } as React.CSSProperties}
          />
          <input
            type="number"
            className={`${styles.editorNumberInput} w-16 px-2 py-1.5 text-sm text-white bg-[#1a1a1c] border border-white/[0.1] rounded-lg text-center`}
            value={maxLossPercent}
            onChange={(e) => {
              const v = Math.min(ceiling, Math.max(0, Number(e.target.value) || 0))
              onChangeMaxLoss(v)
            }}
            min="0"
            max={ceiling}
            aria-label="Max loss percentage input"
          />
          <span className="text-sm text-[#99a1af]">%</span>
        </div>
      </div>

      {/* On-chain enforcement note */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0B] p-4 relative overflow-hidden">
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#0ff0fc]/[0.03] blur-2xl rounded-full pointer-events-none" />
        <div className="relative flex gap-3 z-10 items-start">
          <Info className="h-5 w-5 text-[#0ff0fc] flex-shrink-0 mt-0.5 opacity-80" />
          <p className="text-sm text-[#99a1af] leading-relaxed">
            <strong className="text-[#0ff0fc] font-semibold opacity-90 mr-1">
              On-chain enforcement:
            </strong>
            Constraints are enforced by smart contracts and cannot be changed after commitment creation. Violations are automatically detected and recorded as attestations.
          </p>
        </div>
      </div>
    </section>
  )
}

function getRiskDescription(maxLoss: number): string {
  if (maxLoss <= 10) return 'Conservative: minimal risk exposure'
  if (maxLoss <= 30) return 'Low risk: most capital protected'
  if (maxLoss <= 50) return 'Moderate risk: balanced exposure'
  if (maxLoss <= 70) return 'High risk: significant exposure'
  return 'Aggressive: maximum risk exposure'
}
