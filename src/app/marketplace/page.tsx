'use client'

import Link from 'next/link'
import styles from './page.module.css'

// TODO: Replace with actual data from contracts
const mockListings = [
  {
    id: '1',
    type: 'Balanced',
    amount: '50000',
    remainingDays: 45,
    maxLoss: 8,
    currentYield: '5.2%',
    complianceScore: 92,
  },
  {
    id: '2',
    type: 'Safe',
    amount: '25000',
    remainingDays: 20,
    maxLoss: 2,
    currentYield: '3.1%',
    complianceScore: 100,
  },
]

export default function Marketplace() {
  return (
    <main id="main-content" className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink} aria-label="Back to Home">
          ← Back to Home
        </Link>
        <h1>Commitment Marketplace</h1>
        <p>Browse and trade Commitment NFTs</p>
      </header>

      <div className={styles.marketplaceContent}>
        <div className={styles.filters}>
          <h2>Filters</h2>
          <div className={styles.filterGroup}>
            <label htmlFor="type-filter">Type</label>
            <select id="type-filter">
              <option>All</option>
              <option>Safe</option>
              <option>Balanced</option>
              <option>Aggressive</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="compliance-filter">Min Compliance Score</label>
            <input id="compliance-filter" type="number" min="0" max="100" defaultValue="80" />
          </div>
        </div>

        <div className={styles.listings}>
          {mockListings.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No commitments available in the marketplace.</p>
            </div>
          ) : (
            mockListings.map((listing) => (
              <div key={listing.id} className={styles.listingCard}>
                <div className={styles.listingHeader}>
                  <h3>{listing.type} Commitment</h3>
                  <span className={styles.complianceBadge}>
                    Score: {listing.complianceScore}
                  </span>
                </div>
                <div className={styles.listingBody}>
                  <div className={styles.listingMetric}>
                    <span>Amount:</span>
                    <strong>{listing.amount} XLM</strong>
                  </div>
                  <div className={styles.listingMetric}>
                    <span>Remaining:</span>
                    <strong>{listing.remainingDays} days</strong>
                  </div>
                  <div className={styles.listingMetric}>
                    <span>Max Loss:</span>
                    <strong>{listing.maxLoss}%</strong>
                  </div>
                  <div className={styles.listingMetric}>
                    <span>Current Yield:</span>
                    <strong>{listing.currentYield}</strong>
                  </div>
                </div>
                <div className={styles.listingActions}>
                  <button className={styles.viewButton} aria-label={`View details for ${listing.type} commitment`}>
                    View Details
                  </button>
                  <button className={styles.tradeButton} aria-label={`Trade NFT for ${listing.type} commitment`}>
                    Trade NFT
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}

