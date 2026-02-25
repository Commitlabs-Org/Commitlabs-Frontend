'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import ErrorLayout from '@/components/ErrorLayout'
import ErrorButton from '@/components/ErrorButton'
import styles from './page.module.css'

function TransactionErrorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const errorMessage = searchParams.get('message') || 'Your transaction could not be completed'
  const txHash = searchParams.get('hash')
  const errorCode = searchParams.get('code')

  return (
    <div className={styles.container}>
      {/* Icon/Illustration */}
      <div className={styles.icon}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="60" cy="60" r="55" stroke="white" strokeWidth="2" opacity="0.3" />
          <path
            d="M60 35V75M50 85H70"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            cx="35"
            cy="65"
            r="3"
            fill="white"
            opacity="0.5"
          />
          <circle
            cx="85"
            cy="65"
            r="3"
            fill="white"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Message */}
      <h1 className={styles.title}>Transaction Failed</h1>
      <p className={styles.description}>{errorMessage}</p>

      {/* Error Details */}
      {(txHash || errorCode) && (
        <div className={styles.details}>
          {txHash && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Transaction Hash:</span>
              <code className={styles.detailValue}>{txHash}</code>
              <button
                className={styles.copyButton}
                onClick={() => {
                  navigator.clipboard.writeText(txHash)
                }}
                title="Copy transaction hash"
              >
                📋
              </button>
            </div>
          )}
          {errorCode && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Error Code:</span>
              <code className={styles.detailValue}>{errorCode}</code>
            </div>
          )}
        </div>
      )}

      {/* Troubleshooting Tips */}
      <div className={styles.tips}>
        <h2 className={styles.tipsTitle}>What might have happened:</h2>
        <ul className={styles.tipsList}>
          <li>Insufficient balance or funds</li>
          <li>Network congestion or timeout</li>
          <li>Invalid transaction parameters</li>
          <li>Wallet or signature issue</li>
          <li>Contract execution failed</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className={styles.actions}>
        <ErrorButton onClick={() => router.back()}>
          Try Again
        </ErrorButton>
        <ErrorButton href="/" variant="secondary">
          Go Home
        </ErrorButton>
        {txHash && (
          <ErrorButton
            href={`https://stellar.expert/explorer/public/tx/${txHash}`}
            variant="secondary"
            isExternal
          >
            View on Explorer
          </ErrorButton>
        )}
        <ErrorButton
          href="https://stellar.org/contact"
          variant="secondary"
          isExternal
        >
          Contact Support
        </ErrorButton>
      </div>
    </div>
  )
}

export default function TransactionError() {
  return (
    <ErrorLayout>
      <Suspense fallback={<div className={styles.container}><p>Loading...</p></div>}>
        <TransactionErrorContent />
      </Suspense>
    </ErrorLayout>
  )
}
