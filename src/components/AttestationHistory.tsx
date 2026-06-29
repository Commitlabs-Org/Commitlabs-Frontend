'use client'

import { useState, useEffect } from 'react'
import AttestationFilterBar, { type AttestationFilterBarProps } from './attestation/AttestationFilterBar'
import { type Attestation, type AttestationSeverity, type AttestationType, ATTESTATION_TYPES } from '@/lib/types/domain'

interface AttestationHistoryProps {
  commitmentId: string
}

// Utility function to format relative time
function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffSeconds < 60) {
    return 'just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  } else if (diffWeeks < 4) {
    return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`
  } else if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`
  } else {
    const diffYears = Math.floor(diffMonths / 12)
    return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`
  }
}

// Utility function to truncate hash
function truncateHash(hash: string, startChars: number = 6, endChars: number = 6): string {
  if (!hash || hash.length <= startChars + endChars) {
    return hash
  }
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`
}

// Icon components
function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" stroke="#05DF72" strokeWidth="2" fill="none" />
      <path
        d="M6 10L9 13L14 7"
        stroke="#05DF72"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 3L2 17H18L10 3Z"
        stroke="#FF8A04"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M10 8V12"
        stroke="#FF8A04"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="14" r="1" fill="#FF8A04" />
    </svg>
  )
}

function ViolationIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" stroke="#FF6900" strokeWidth="2" fill="none" />
      <path
        d="M6 6L14 14M14 6L6 14"
        stroke="#FF6900"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function AttestationHistory({ commitmentId }: AttestationHistoryProps) {
  const [attestations, setAttestations] = useState<Attestation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<{
    severity: AttestationSeverity | 'all'
    type: AttestationType | 'all'
  }>({
    severity: 'all',
    type: 'all',
  })

  useEffect(() => {
    async function fetchAttestations() {
      try {
        setLoading(true)
        const response = await fetch('/api/attestations')
        if (!response.ok) {
          throw new Error('Failed to fetch attestations')
        }
        const data = await response.json()
        // Filter attestations for this commitment
        const commitmentAttestations = (data.attestations || []).filter(
          (a: Attestation) => a.commitmentId === commitmentId
        )
        setAttestations(commitmentAttestations)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchAttestations()
  }, [commitmentId])

  // Apply filters
  const filteredAttestations = attestations.filter((attestation: Attestation) => {
    const severityMatch = filters.severity === 'all' || attestation.severity === filters.severity
    const typeMatch = filters.type === 'all' || attestation.kind === filters.type
    return severityMatch && typeMatch
  })

  // Calculate compliance trend summary
  const complianceSummary = {
    total: attestations.length,
    ok: attestations.filter((a: Attestation) => a.severity === 'ok').length,
    warning: attestations.filter((a: Attestation) => a.severity === 'warning').length,
    violation: attestations.filter((a: Attestation) => a.severity === 'violation').length,
  }

  const getSeverityIcon = (severity?: AttestationSeverity) => {
    switch (severity) {
      case 'ok':
        return <CheckIcon />
      case 'warning':
        return <WarningIcon />
      case 'violation':
        return <ViolationIcon />
      default:
        return null
    }
  }

  const getSeverityClass = (severity?: AttestationSeverity) => {
    switch (severity) {
      case 'ok':
        return 'border-green-500 bg-green-50'
      case 'warning':
        return 'border-yellow-500 bg-yellow-50'
      case 'violation':
        return 'border-red-500 bg-red-50'
      default:
        return 'border-gray-300 bg-gray-50'
    }
  }

  const handleFilterChange: AttestationFilterBarProps['onFilterChange'] = (newFilters) => {
    setFilters(newFilters)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error loading attestations: {error}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Attestation History</h2>

      {/* Compliance Trend Summary */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Compliance Trend Summary</h3>
        <div className="flex gap-6">
          <div>
            <span className="text-2xl font-bold text-gray-900">{complianceSummary.total}</span>
            <span className="text-sm text-gray-600 ml-1">Total</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-green-600">{complianceSummary.ok}</span>
            <span className="text-sm text-gray-600 ml-1">Info</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-yellow-600">{complianceSummary.warning}</span>
            <span className="text-sm text-gray-600 ml-1">Warnings</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-red-600">{complianceSummary.violation}</span>
            <span className="text-sm text-gray-600 ml-1">Violations</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <AttestationFilterBar
        attestations={attestations.map((a: Attestation) => ({
          id: a.id,
          severity: a.severity,
          attestationType: a.kind as AttestationType,
        }))}
        onFilterChange={handleFilterChange}
      />

      {/* Attestation Timeline */}
      <div id="attestation-list" className="mt-6 space-y-4" role="list">
        {filteredAttestations.length === 0 ? (
          <div className="text-center py-12 text-gray-500" role="listitem">
            <p>No attestations match the current filters.</p>
          </div>
        ) : (
          filteredAttestations.map((attestation) => (
            <div
              key={attestation.id}
              className={`p-4 rounded-lg border-l-4 ${getSeverityClass(attestation.severity)}`}
              role="listitem"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1" aria-hidden="true">
                  {getSeverityIcon(attestation.severity)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">
                      {attestation.title || attestation.kind || 'Attestation'}
                    </h4>
                    <span className="text-sm text-gray-500">
                      {formatRelativeTime(attestation.observedAt)}
                    </span>
                  </div>
                  {attestation.description && (
                    <p className="text-sm text-gray-600 mt-1">{attestation.description}</p>
                  )}
                  {attestation.txHash && (
                    <p className="text-xs text-gray-500 mt-2">
                      TX: {truncateHash(attestation.txHash)}
                    </p>
                  )}
                  {attestation.details && Object.keys(attestation.details).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      <details>
                        <summary className="cursor-pointer hover:text-gray-700">View details</summary>
                        <pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto">
                          {JSON.stringify(attestation.details, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

