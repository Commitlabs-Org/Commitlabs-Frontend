'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ErrorLayout from '@/components/ErrorLayout'
import ErrorButton from '@/components/ErrorButton'
import styles from './page.module.css'

type TransactionErrorCategory = 'rejected' | 'timed-out' | 'failed'

interface RecoveryContent {
  eyebrow: string
  title: string
  description: string
  summaryTitle: string
  summary: string
  tipsTitle: string
  tips: string[]
  explorerLabel?: string
}

const ERROR_CODE_TO_CATEGORY: Record<string, TransactionErrorCategory> = {
  VALIDATION_ERROR: 'rejected',
  BAD_REQUEST: 'rejected',
  UNPROCESSABLE_ENTITY: 'rejected',
  CONFLICT: 'rejected',
  USER_REJECTED: 'rejected',
  SIGNATURE_INVALID: 'rejected',
  GATEWAY_TIMEOUT: 'timed-out',
  RPC_TIMEOUT: 'timed-out',
  BLOCKCHAIN_UNAVAILABLE: 'timed-out',
  SERVICE_UNAVAILABLE: 'timed-out',
  BLOCKCHAIN_CALL_FAILED: 'failed',
  BAD_GATEWAY: 'failed',
  INTERNAL_ERROR: 'failed',
}

const RECOVERY_CONTENT: Record<TransactionErrorCategory, RecoveryContent> = {
  rejected: {
    eyebrow: 'Rejected',
    title: 'Transaction Rejected',
    description:
      'The transaction was not accepted because the signature, parameters, or current commitment state need attention.',
    summaryTitle: 'No transaction was completed',
    summary:
      'Review the details, adjust anything that changed, then try again when you are ready.',
    tipsTitle: 'Before trying again',
    tips: [
      'Confirm the wallet signature prompt was approved.',
      'Check the amount, maturity date, and commitment state.',
      'Refresh the commitment details if another action may have changed it.',
    ],
  },
  'timed-out': {
    eyebrow: 'Timed out',
    title: 'Transaction Status Unknown',
    description:
      'The network did not confirm the transaction before the request timed out. It may still settle on-chain.',
    summaryTitle: 'Check before resubmitting',
    summary:
      'Use the explorer link when a hash is available, or return to your dashboard to verify the latest state before retrying.',
    tipsTitle: 'Recommended recovery',
    tips: [
      'Look up the transaction hash if one was returned.',
      'Avoid submitting the same signed transaction twice.',
      'Retry only after the dashboard or explorer shows no completed action.',
    ],
    explorerLabel: 'Check Explorer',
  },
  failed: {
    eyebrow: 'Failed',
    title: 'Transaction Failed',
    description:
      'The blockchain call failed during execution or the upstream chain service returned an error.',
    summaryTitle: 'The action did not finish',
    summary:
      'You can retry the action, but review the error code first because some failures require updated transaction details.',
    tipsTitle: 'What to check',
    tips: [
      'Confirm your balance and required fees are still available.',
      'Check whether the smart contract rejected the operation.',
      'Try again after a short pause if the chain service was unavailable.',
    ],
    explorerLabel: 'View on Explorer',
  },
}

function getCategoryFromParams(category: string | null, code: string | null): TransactionErrorCategory {
  const normalizedCategory = category?.toLowerCase()

  if (
    normalizedCategory === 'rejected' ||
    normalizedCategory === 'timed-out' ||
    normalizedCategory === 'failed'
  ) {
    return normalizedCategory
  }

  const normalizedCode = code?.toUpperCase()
  return normalizedCode ? ERROR_CODE_TO_CATEGORY[normalizedCode] ?? 'failed' : 'failed'
}

function TransactionErrorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const headingRef = useRef<HTMLHeadingElement>(null)

  const category = useMemo(
    () => getCategoryFromParams(searchParams.get('category'), searchParams.get('code')),
    [searchParams],
  )
  const content = RECOVERY_CONTENT[category]
  const errorMessage = searchParams.get('message') || content.description
  const txHash = searchParams.get('hash')
  const errorCode = searchParams.get('code')

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section className={styles.container} aria-labelledby="transaction-error-title">
      <div className={`${styles.icon} ${styles[category]}`} aria-hidden="true">
        <svg
          width="96"
          height="96"
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="2" opacity="0.35" />
          <circle cx="48" cy="48" r="28" fill="currentColor" opacity="0.12" />
          {category === 'timed-out' ? (
            <>
              <path d="M48 28v22l14 8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M32 20h32" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </>
          ) : category === 'rejected' ? (
            <>
              <path d="M34 34l28 28M62 34 34 62" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M28 48h-6M74 48h-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
            </>
          ) : (
            <>
              <path d="M48 26v30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <circle cx="48" cy="68" r="3" fill="currentColor" />
            </>
          )}
        </svg>
      </div>

      <p className={styles.eyebrow}>{content.eyebrow}</p>
      <h1
        id="transaction-error-title"
        ref={headingRef}
        className={styles.title}
        tabIndex={-1}
      >
        {content.title}
      </h1>
      <p className={styles.description}>{errorMessage}</p>

      <div className={styles.recoverySummary}>
        <h2 className={styles.sectionTitle}>{content.summaryTitle}</h2>
        <p>{content.summary}</p>
      </div>

      {(txHash || errorCode) && (
        <dl className={styles.details} aria-label="Transaction error details">
          {txHash && (
            <div className={styles.detailItem}>
              <dt className={styles.detailLabel}>Transaction Hash</dt>
              <dd className={styles.detailValue}>
                <code>{txHash}</code>
              </dd>
              <button
                className={styles.copyButton}
                onClick={() => {
                  void navigator.clipboard?.writeText(txHash)
                }}
                title="Copy transaction hash"
                aria-label="Copy transaction hash"
              >
                Copy
              </button>
            </div>
          )}
          {errorCode && (
            <div className={styles.detailItem}>
              <dt className={styles.detailLabel}>Error Code</dt>
              <dd className={styles.detailValue}>
                <code>{errorCode}</code>
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className={styles.tips}>
        <h2 className={styles.sectionTitle}>{content.tipsTitle}</h2>
        <ul className={styles.tipsList}>
          {content.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>

      <div className={styles.actions}>
        <ErrorButton onClick={() => router.back()}>
          Try Again
        </ErrorButton>
        <ErrorButton href="/commitments/overview" variant="secondary">
          Go to Dashboard
        </ErrorButton>
        {txHash && (
          <ErrorButton
            href={`https://stellar.expert/explorer/public/tx/${encodeURIComponent(txHash)}`}
            variant="secondary"
            isExternal
          >
            {content.explorerLabel ?? 'View on Explorer'}
          </ErrorButton>
        )}
      </div>
    </section>
  )
}

export default function TransactionError() {
  return (
    <ErrorLayout>
      <Suspense fallback={<div className={styles.container}><p role="status">Loading...</p></div>}>
        <TransactionErrorContent />
      </Suspense>
    </ErrorLayout>
  )
}
