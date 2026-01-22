'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

export default function CreateCommitment() {
  const [commitmentType, setCommitmentType] = useState<'safe' | 'balanced' | 'aggressive'>('balanced')
  const [duration, setDuration] = useState(30)
  const [amount, setAmount] = useState('')
  const [maxLoss, setMaxLoss] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement commitment creation
    console.log('Creating commitment:', {
      type: commitmentType,
      duration,
      amount,
      maxLoss,
    })
    alert('Commitment creation will be implemented here')
  }

  return (
    <main id="main-content" className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink} aria-label="Back to Home">
          ← Back to Home
        </Link>
        <h1>Create Liquidity Commitment</h1>
        <p>Define the rules for how your liquidity behaves</p>
      </header>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.section}>
          <h2>Commitment Type</h2>
          <div className={styles.typeSelector}>
            <button
              type="button"
              className={`${styles.typeButton} ${commitmentType === 'safe' ? styles.active : ''}`}
              onClick={() => setCommitmentType('safe')}
              aria-pressed={commitmentType === 'safe'}
            >
              <h3>Safe Commitment</h3>
              <p>Duration: 30 days</p>
              <p>Max loss: 2%</p>
              <p>Lower but stable yield</p>
            </button>
            <button
              type="button"
              className={`${styles.typeButton} ${commitmentType === 'balanced' ? styles.active : ''}`}
              onClick={() => setCommitmentType('balanced')}
              aria-pressed={commitmentType === 'balanced'}
            >
              <h3>Balanced Commitment</h3>
              <p>Duration: 60 days</p>
              <p>Max loss: 8%</p>
              <p>Medium yield</p>
            </button>
            <button
              type="button"
              className={`${styles.typeButton} ${commitmentType === 'aggressive' ? styles.active : ''}`}
              onClick={() => setCommitmentType('aggressive')}
              aria-pressed={commitmentType === 'aggressive'}
            >
              <h3>Aggressive Commitment</h3>
              <p>Duration: 90 days</p>
              <p>No loss protection</p>
              <p>Highest yield potential</p>
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Commitment Parameters</h2>
          <div className={styles.formGroup}>
            <label htmlFor="duration">Duration (days)</label>
            <input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min="1"
              max="365"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="amount">Amount (XLM)</label>
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100000"
              min="0"
              step="0.0000001"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="maxLoss">Max Loss (%)</label>
            <input
              id="maxLoss"
              type="number"
              value={maxLoss}
              onChange={(e) => setMaxLoss(e.target.value)}
              placeholder="2"
              min="0"
              max="100"
              required
            />
          </div>
        </div>

        <div className={styles.section}>
          <h2>Summary</h2>
          <div className={styles.summary}>
            <p><strong>Type:</strong> {commitmentType}</p>
            <p><strong>Duration:</strong> {duration} days</p>
            <p><strong>Amount:</strong> {amount || '0'} XLM</p>
            <p><strong>Max Loss:</strong> {maxLoss || '0'}%</p>
            <p><strong>Early Exit Penalty:</strong> {commitmentType === 'aggressive' ? '5%' : '2%'}</p>
          </div>
        </div>

        <button type="submit" className={styles.submitButton}>
          Create Commitment
        </button>
      </form>
    </main>
  )
}

