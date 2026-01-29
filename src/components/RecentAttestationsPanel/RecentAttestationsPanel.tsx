'use client'

import styles from './RecentAttestationsPanel.module.css'

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
  summary: {
    complianceCount: number
    warningCount: number
    violationCount: number
  }
  onSelectAttestation: (id: string) => void
  onViewAll: () => void
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

export default function RecentAttestationsPanel({
  attestations,
  summary,
  onSelectAttestation,
  onViewAll,
}: RecentAttestationsPanelProps) {
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
      <header className={styles.header}>
        <h2 className={styles.title}>Recent Attestations</h2>
        <button
          type="button"
          className={styles.viewAllButton}
          onClick={onViewAll}
          aria-label="View all attestations"
        >
          View All
          <ArrowRightIcon />
        </button>
      </header>

      <div className={styles.attestationsList} role="list">
        {attestations.length === 0 ? (
          <div className={styles.emptyState} role="listitem">
            <p>No attestations available</p>
          </div>
        ) : (
          attestations.map((attestation) => (
            <button
              key={attestation.id}
              type="button"
              className={`${styles.attestationRow} ${getSeverityClass(attestation.severity)}`}
              onClick={() => onSelectAttestation(attestation.id)}
              aria-label={`${attestation.severity} attestation: ${attestation.title}`}
              role="listitem"
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
          ))
        )}
      </div>

      <footer className={styles.footer}>
        <div className={`${styles.footerColumn} ${styles.footerCompliance}`}>
          <div className={styles.footerValue} aria-label={`${summary.complianceCount} compliance attestations`}>
            {summary.complianceCount}
          </div>
          <div className={styles.footerLabel}>Compliance</div>
        </div>
        <div className={`${styles.footerColumn} ${styles.footerWarning}`}>
          <div className={styles.footerValue} aria-label={`${summary.warningCount} warning attestations`}>
            {summary.warningCount}
          </div>
          <div className={styles.footerLabel}>Warnings</div>
        </div>
        <div className={`${styles.footerColumn} ${styles.footerViolation}`}>
          <div className={styles.footerValue} aria-label={`${summary.violationCount} violation attestations`}>
            {summary.violationCount}
          </div>
          <div className={styles.footerLabel}>Violations</div>
        </div>
      </footer>
    </section>
  )
}
