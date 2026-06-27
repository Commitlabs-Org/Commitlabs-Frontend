'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Bell, BellOff, Send } from 'lucide-react'
import { useTestNotification } from '@/hooks/useTestNotification'

interface NotificationToggleProps {
  id: string
  label: string
  description: string
  enabled: boolean
  onChange: (enabled: boolean) => void
  onTestSend?: () => void
  isTestSending?: boolean
}

export const NotificationToggle: React.FC<NotificationToggleProps> = ({
  id,
  label,
  description,
  enabled,
  onChange,
  onTestSend,
  isTestSending,
}) => {
  const { sendTest, isSending } = useTestNotification(id)

  const handleTestSend = onTestSend || sendTest
  const currentIsSending = isTestSending !== undefined ? isTestSending : isSending

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

      <div className="flex items-center gap-3">
        <button
          onClick={handleTestSend}
          disabled={currentIsSending || !enabled}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
          aria-label={`Send test notification for ${label}`}
        >
          <Send size={14} className={currentIsSending ? 'animate-pulse' : ''} />
          <span className="hidden sm:inline">{currentIsSending ? 'Sending...' : 'Send test'}</span>
        </button>
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
    </div>
  )
}
