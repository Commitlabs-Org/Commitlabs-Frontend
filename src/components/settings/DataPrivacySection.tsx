'use client'

import React, { useState } from 'react'
import { ShieldCheck, Download, Trash2 } from 'lucide-react'
import { NotificationSection } from './NotificationSection'

export interface UserExportData {
  exportedAt: string
  account: string
  preferences: Record<string, unknown>
  watchlist: string[]
  drafts: string[]
}

interface DataPrivacySectionProps {
  /** Connected wallet address; empty string when disconnected */
  walletAddress?: string
  /** Optional override for gathering preferences (injected for testing) */
  getPreferences?: () => Record<string, unknown>
}

/**
 * Data & Privacy settings panel.
 *
 * - Exports client-held user data (preferences, watchlist, drafts) as a
 *   downloadable JSON file. Secrets are never included.
 * - Provides a "Clear local data" action guarded by a confirmation step.
 * - Uses ARIA live regions to announce success / error feedback to screen
 *   readers without moving focus.
 */
export const DataPrivacySection: React.FC<DataPrivacySectionProps> = ({
  walletAddress = '',
  getPreferences,
}) => {
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [clearStatus, setClearStatus] = useState<'idle' | 'confirming' | 'success' | 'error'>('idle')

  const buildExportPayload = (): UserExportData => {
    const preferences = getPreferences
      ? getPreferences()
      : (() => {
          try {
            const raw = localStorage.getItem('cl:preferences')
            return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
          } catch {
            return {}
          }
        })()

    const watchlist: string[] = (() => {
      try {
        const raw = localStorage.getItem('cl:watchlist')
        return raw ? (JSON.parse(raw) as string[]) : []
      } catch {
        return []
      }
    })()

    const drafts: string[] = (() => {
      try {
        const raw = localStorage.getItem('cl:drafts')
        return raw ? (JSON.parse(raw) as string[]) : []
      } catch {
        return []
      }
    })()

    return {
      exportedAt: new Date().toISOString(),
      account: walletAddress,
      preferences,
      watchlist,
      drafts,
    }
  }

  const handleExport = () => {
    try {
      const payload = buildExportPayload()
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `commitlabs-data-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportStatus('success')
      setTimeout(() => setExportStatus('idle'), 3000)
    } catch {
      setExportStatus('error')
      setTimeout(() => setExportStatus('idle'), 3000)
    }
  }

  const handleClearRequest = () => {
    setClearStatus('confirming')
  }

  const handleClearConfirm = () => {
    try {
      ;['cl:preferences', 'cl:watchlist', 'cl:drafts'].forEach((key) =>
        localStorage.removeItem(key),
      )
      setClearStatus('success')
      setTimeout(() => setClearStatus('idle'), 3000)
    } catch {
      setClearStatus('error')
      setTimeout(() => setClearStatus('idle'), 3000)
    }
  }

  const handleClearCancel = () => {
    setClearStatus('idle')
  }

  return (
    <NotificationSection
      title="Data &amp; Privacy"
      description="Export or clear the data CommitLabs holds about you locally."
      icon={<ShieldCheck size={20} />}
    >
      {/* Export account data */}
      <div className="p-6 rounded-2xl border border-white/10 bg-white/5 space-y-4">
        <div>
          <h3 className="font-semibold text-white">Export Account Data</h3>
          <p className="text-sm text-white/50 mt-1">
            Download your preferences, watchlist, and drafts as a JSON file.
            Secrets and private keys are never included.
          </p>
        </div>

        <button
          onClick={handleExport}
          aria-label="Export account data as JSON"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0FF0FC]/10 text-[#0FF0FC] border border-[#0FF0FC]/20 hover:bg-[#0FF0FC]/20 font-semibold transition-all active:scale-[0.98]"
        >
          <Download size={16} />
          Export Data
        </button>

        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-sm"
        >
          {exportStatus === 'success' && (
            <span className="text-green-400">Export downloaded successfully.</span>
          )}
          {exportStatus === 'error' && (
            <span className="text-red-400">Export failed. Please try again.</span>
          )}
        </div>
      </div>

      {/* Clear local data */}
      <div className="p-6 rounded-2xl border border-white/10 bg-white/5 space-y-4">
        <div>
          <h3 className="font-semibold text-white">Clear Local Data</h3>
          <p className="text-sm text-white/50 mt-1">
            Remove all locally stored preferences, watchlist entries, and drafts
            from this device. This does not affect on-chain state.
          </p>
        </div>

        {clearStatus === 'confirming' ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-yellow-400">
              Are you sure? This cannot be undone.
            </p>
            <button
              onClick={handleClearConfirm}
              aria-label="Confirm clear local data"
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30 font-semibold text-sm transition-all active:scale-[0.98]"
            >
              Confirm
            </button>
            <button
              onClick={handleClearCancel}
              aria-label="Cancel clear local data"
              className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 font-semibold text-sm transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleClearRequest}
            aria-label="Clear all local data"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-semibold transition-all active:scale-[0.98]"
          >
            <Trash2 size={16} />
            Clear Local Data
          </button>
        )}

        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-sm"
        >
          {clearStatus === 'success' && (
            <span className="text-green-400">Local data cleared successfully.</span>
          )}
          {clearStatus === 'error' && (
            <span className="text-red-400">Failed to clear data. Please try again.</span>
          )}
        </div>
      </div>
    </NotificationSection>
  )
}
