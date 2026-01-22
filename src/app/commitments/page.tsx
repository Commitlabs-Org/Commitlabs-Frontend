'use client'

import Link from 'next/link'
import styles from './page.module.css'

// TODO: Replace with actual data from contracts
const mockCommitments = [
  {
    id: '1',
    type: 'Balanced',
    amount: '100000',
    duration: 60,
    maxLoss: 8,
    status: 'active',
    createdAt: '2024-01-15',
    expiresAt: '2024-03-15',
    currentValue: '102000',
    complianceScore: 95,
  },
  {
    id: '2',
    type: 'Safe',
    amount: '50000',
    duration: 30,
    maxLoss: 2,
    status: 'active',
    createdAt: '2024-01-20',
    expiresAt: '2024-02-20',
    currentValue: '50100',
    complianceScore: 100,
  },
]

export default function MyCommitments() {
  return (
    <main id="main-content" className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink} aria-label="Back to Home">
          ← Back to Home
        </Link>
        <h1>My Commitments</h1>
        <p>View and manage your liquidity commitments</p>
      </header>

      <div className={styles.commitmentsList}>
        {mockCommitments.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No commitments yet. Create your first commitment to get started.</p>
            <Link href="/create" className={styles.createLink}>
              Create Commitment
            </Link>
          </div>
        ) : (
          mockCommitments.map((commitment) => (
            <div key={commitment.id} className={styles.commitmentCard}>
              <div className={styles.cardHeader}>
                <h2>{commitment.type} Commitment</h2>
                <span className={`${styles.status} ${styles[commitment.status]}`}>
                  {commitment.status}
                </span>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.metric}>
                  <span className={styles.label}>Amount:</span>
                  <span className={styles.value}>{commitment.amount} XLM</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.label}>Current Value:</span>
                  <span className={styles.value}>{commitment.currentValue} XLM</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.label}>Duration:</span>
                  <span className={styles.value}>{commitment.duration} days</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.label}>Max Loss:</span>
                  <span className={styles.value}>{commitment.maxLoss}%</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.label}>Compliance Score:</span>
                  <span className={styles.value}>{commitment.complianceScore}/100</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.label}>Expires:</span>
                  <span className={styles.value}>{commitment.expiresAt}</span>
                </div>
              </div>

              <div className={styles.cardActions}>
                <button className={styles.actionButton} aria-label={`View details for ${commitment.type} commitment`}>
                  View Details
                </button>
                <button className={styles.actionButton} aria-label={`View attestations for ${commitment.type} commitment`}>
                  View Attestations
                </button>
                <button className={styles.actionButtonDanger} aria-label={`Early exit for ${commitment.type} commitment`}>
                  Early Exit
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}

