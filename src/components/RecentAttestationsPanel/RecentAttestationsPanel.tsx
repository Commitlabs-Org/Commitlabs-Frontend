'use client'

import { useCallback, useEffect, useState } from 'react'
import styles from './RecentAttestationsPanel.module.css'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAttestationStream } from '@/hooks/useAttestationStream'
import {
  buildAttestationCsvContent,
  buildAttestationExportFilename,
  downloadCsvContent,
} from '@/utils/chartExport'

export interface Attestation {
  id: string
  title: string
  description: string
  txHash: string
  timestamp: string | Date
  severity: 'ok' | 'warning' | 'violation'
}

export interface RecentAttestationsPanelProps {
  attestations: Attestation[]
  /** Optional commitment ID to enable real-time SSE streaming of new attestations. */
  commitmentId?: string | null
  summary: {
    complianceCount: number
    warningCount: number
    violationCount: number
  }
  onSelectAttestation: (id: string) => void
  onViewAll: () => void
  /** Set to false to disable streaming even when commitmentId is provided. */
  streamingEnabled?: boolean
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

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 12L10 8L6 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M8 2v8M5 7l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 13h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function RecentAttestationsPanel({
  attestations,
  commitmentId,
  onSelectAttestation,
  onViewAll,
  streamingEnabled = true,
}: RecentAttestationsPanelProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [displayedAttestations, setDisplayedAttestations] = useState(attestations)
  const [liveAnnouncement, setLiveAnnouncement] = useState('')
  const normalizedCommitmentId = commitmentId ?? null

  useEffect(() => {
    setDisplayedAttestations(attestations)
  }, [attestations])

  const handleAttestation = useCallback((incomingAttestation: Attestation) => {
    setDisplayedAttestations((previousAttestations) => {
      const dedupedAttestations = previousAttestations.filter(
        (existingAttestation) => existingAttestation.id !== incomingAttestation.id,
      )
      return [incomingAttestation, ...dedupedAttestations]
    })
    setLiveAnnouncement(`New attestation: ${incomingAttestation.title}`)
  }, [])

  useAttestationStream({
    commitmentId: normalizedCommitmentId,
    enabled: streamingEnabled,
    onAttestation: handleAttestation,
  })

  const summaryCounts = {
    complianceCount: displayedAttestations.filter((attestation) => attestation.severity === 'ok').length,
    warningCount: displayedAttestations.filter((attestation) => attestation.severity === 'warning').length,
    violationCount: displayedAttestations.filter((attestation) => attestation.severity === 'violation').length,
  }

  const handleExportCsv = useCallback(() => {
    if (displayedAttestations.length === 0) return
    setIsExporting(true)

    const content = buildAttestationCsvContent(displayedAttestations)
    const filename = buildAttestationExportFilename(normalizedCommitmentId ?? '')

    void downloadCsvContent(content, filename).finally(() => {
      setIsExporting(false)
    })
  }, [displayedAttestations, normalizedCommitmentId])

  const getSeverityIcon = (severity: Attestation['severity']) => {
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

  const getSeverityClass = (severity: Attestation['severity']) => {
    switch (severity) {
      case 'ok':
        return styles.ok
      case 'warning':
        return styles.warning
      case 'violation':
        return styles.violation
      default:
        return ''
    }
  }

  return (
    <section className={styles.panel} aria-label="Recent Attestations">
      {/* Accessible live region for new attestation announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      <header className={styles.header}>
        <h2 className={styles.title}>Recent Attestations</h2>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.exportButton}
            onClick={handleExportCsv}
            disabled={displayedAttestations.length === 0 || isExporting}
            aria-label={
              displayedAttestations.length === 0
                ? 'Export attestations as CSV (no attestations to export)'
                : 'Export attestations as CSV'
            }
            aria-disabled={displayedAttestations.length === 0 || isExporting}
          >
            <DownloadIcon />
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            className={styles.viewAllButton}
            onClick={onViewAll}
            aria-label="View all attestations"
          >
            View All
            <ArrowRightIcon />
          </button>
        </div>
      </header>

      <div className={styles.attestationsList} role="list">
        {displayedAttestations.length === 0 ? (
          <div className={styles.emptyState}>
            <EmptyState title="No attestations available" />
          </div>
        ) : (
          displayedAttestations.map((attestation) => (
            <li key={attestation.id} className={styles.attestationRow}>
              <button
                type="button"
                className={`${styles.attestationButton} ${getSeverityClass(attestation.severity)}`}
                onClick={() => onSelectAttestation(attestation.id)}
                aria-label={`${attestation.severity} attestation: ${attestation.title}`}
              >
                <div className={styles.rowLeft} aria-hidden="true">
                  {getSeverityIcon(attestation.severity)}
                </div>
                <div className={styles.rowContent}>
                  <h3 className={styles.rowTitle}>{attestation.title}</h3>
                  <p className={styles.rowDescription}>{attestation.description}</p>
                  <p className={styles.rowTxHash}>
                    TX: {truncateHash(attestation.txHash)}
                  </p>
                </div>
                <div className={styles.rowRight}>
                  <span className={styles.rowTimestamp}>
                    {formatRelativeTime(attestation.timestamp)}
                  </span>
                </div>
              </button>
            </li>
          ))
        )}
      </div>

      <footer className={styles.footer}>
        <div className={`${styles.footerColumn} ${styles.footerCompliance}`}>
          <div className={styles.footerValue} aria-label={`${summaryCounts.complianceCount} compliance attestations`}>
            {summaryCounts.complianceCount}
          </div>
          <div className={styles.footerLabel}>Compliance</div>
        </div>
        <div className={`${styles.footerColumn} ${styles.footerWarning}`}>
          <div className={styles.footerValue} aria-label={`${summaryCounts.warningCount} warning attestations`}>
            {summaryCounts.warningCount}
          </div>
          <div className={styles.footerLabel}>Warnings</div>
        </div>
        <div className={`${styles.footerColumn} ${styles.footerViolation}`}>
          <div className={styles.footerValue} aria-label={`${summaryCounts.violationCount} violation attestations`}>
            {summaryCounts.violationCount}
          </div>
          <div className={styles.footerLabel}>Violations</div>
        </div>
      </footer>
    </section>
  )
}
