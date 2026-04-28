'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Bell, BellOff } from 'lucide-react'

interface NotificationToggleProps {
  id: string
  label: string
  description: string
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export const NotificationToggle: React.FC<NotificationToggleProps> = ({
  id,
  label,
  description,
  enabled,
  onChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <label 
            htmlFor={id} 
            className="text-base font-semibold text-white cursor-pointer"
          >
            {label}
          </label>
          {enabled ? (
            <Bell size={14} className="text-[#0FF0FC]" />
          ) : (
            <BellOff size={14} className="text-white/30" />
          )}
        </div>
        <p className="text-sm text-white/50 leading-relaxed max-w-2xl">
          {description}
        </p>
      </div>

      <button
        id={id}
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`
          relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full 
          transition-colors duration-200 ease-in-out focus-visible:outline-none 
          focus-visible:ring-2 focus-visible:ring-[#0FF0FC] focus-visible:ring-offset-2 
          focus-visible:ring-offset-[#0a0a0a]
          ${enabled ? 'bg-[#0FF0FC]' : 'bg-white/20'}
        `}
      >
        <span className="sr-only">Toggle {label}</span>
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`
            pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 
            ${enabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  )
}
