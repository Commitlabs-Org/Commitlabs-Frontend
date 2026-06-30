'use client'

import React, { useState, useCallback } from 'react'
import { Monitor, AlertTriangle, Trash2 } from 'lucide-react'
import { NotificationSection } from './NotificationSection'

export interface ActiveSession {
  id: string
  userAgent: string
  ipAddress: string
  createdAt: string
  isCurrent: boolean
}

interface ActiveSessionsSectionProps {
  sessions?: ActiveSession[]
  onRevokeOthers?: () => Promise<void>
}

export const ActiveSessionsSection: React.FC<ActiveSessionsSectionProps> = ({
  sessions = [],
  onRevokeOthers,
}) => {
  const [revoking, setRevoking] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const handleRevokeClick = () => {
    setConfirmOpen(true)
    setError(null)
    setStatus(null)
  }

  const handleConfirm = useCallback(async () => {
    setConfirmOpen(false)
    setRevoking(true)
    setError(null)
    try {
      if (onRevokeOthers) {
        await onRevokeOthers()
      } else {
        const res = await fetch('/api/auth/sessions/revoke-others', {
          method: 'POST',
          credentials: 'same-origin',
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error ?? 'Failed to revoke other sessions')
        }
      }
      setStatus('All other sessions have been revoked.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setRevoking(false)
    }
  }, [onRevokeOthers])

  const handleCancel = () => setConfirmOpen(false)

  const otherSessionCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <NotificationSection
      title="Active Sessions"
      description="View all devices signed into your account and revoke access from other sessions."
      icon={<Monitor size={20} />}
    >
      <div
        role="region"
        aria-label="Active sessions list"
        className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
      >
        {/* Status live region */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {status}
          {error ? `Error: ${error}` : ''}
        </div>

        {sessions.length === 0 ? (
          <p className="p-6 text-white/50 text-sm">No session data available.</p>
        ) : (
          <ul aria-label="Sessions" className="divide-y divide-white/10">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-start gap-4 p-4">
                <div className="mt-0.5 p-2 rounded-lg bg-white/5 text-[#0FF0FC] shrink-0">
                  <Monitor size={16} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {session.userAgent || 'Unknown device'}
                    {session.isCurrent && (
                      <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded-full bg-[#0FF0FC]/20 text-[#0FF0FC] font-semibold">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {session.ipAddress} &middot; Signed in {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {otherSessionCount > 0 && (
          <div className="p-4 border-t border-white/10">
            {confirmOpen ? (
              <div
                role="alertdialog"
                aria-labelledby="revoke-confirm-title"
                aria-describedby="revoke-confirm-desc"
                className="space-y-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-400 shrink-0" aria-hidden="true" />
                  <p id="revoke-confirm-title" className="text-sm font-semibold text-red-300">
                    Revoke {otherSessionCount} other session{otherSessionCount > 1 ? 's' : ''}?
                  </p>
                </div>
                <p id="revoke-confirm-desc" className="text-xs text-white/60">
                  Those devices will be signed out immediately. This action cannot be undone.
                </p>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 text-sm font-semibold transition-all active:scale-[0.98]"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Yes, revoke
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 text-sm font-semibold transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <p role="alert" className="mb-3 text-sm text-red-400 flex items-center gap-2">
                    <AlertTriangle size={14} aria-hidden="true" />
                    {error}
                  </p>
                )}
                {status && !error && (
                  <p className="mb-3 text-sm text-[#0FF0FC]">{status}</p>
                )}
                <button
                  onClick={handleRevokeClick}
                  disabled={revoking}
                  aria-busy={revoking}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] border ${
                    revoking
                      ? 'bg-red-500/10 text-red-300/50 border-red-500/10 cursor-not-allowed'
                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 border-red-500/20'
                  }`}
                >
                  {revoking ? (
                    <div
                      className="h-4 w-4 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2 size={16} aria-hidden="true" />
                  )}
                  Revoke Other Sessions
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </NotificationSection>
  )
}
