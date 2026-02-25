'use client'

import { useCallback } from 'react'
import ErrorLayout from '@/components/ErrorLayout'
import ErrorButton from '@/components/ErrorButton'
import styles from './error.module.css'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  const handleRetry = useCallback(() => {
    reset()
  }, [reset])

  return (
    <ErrorLayout>
      <div className={styles.container}>
        {/* Large 500 Display */}
        <div className={styles.errorCode}>500</div>

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
              d="M60 35V65M60 75V85"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="40" cy="50" r="6" fill="white" opacity="0.6" />
            <circle cx="80" cy="50" r="6" fill="white" opacity="0.6" />
          </svg>
        </div>

        {/* Message */}
        <h1 className={styles.title}>Something Went Wrong</h1>
        <p className={styles.description}>
          We're experiencing technical difficulties. Our team has been notified and is working to fix the issue.
        </p>

        {/* Error Details (if available) */}
        {error && (
          <div className={styles.errorDetails}>
            <p className={styles.errorMessage}>
              {error.message || 'An unexpected error occurred'}
            </p>
            {error.digest && (
              <p className={styles.errorDigest}>Error ID: {error.digest}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.actions}>
          <ErrorButton onClick={handleRetry}>Try Again</ErrorButton>
          <ErrorButton href="/" variant="secondary">
            Go Home
          </ErrorButton>
          <ErrorButton
            href="https://stellar.org/contact"
            variant="secondary"
            isExternal
          >
            Report Issue
          </ErrorButton>
        </div>
      </div>
    </ErrorLayout>
  )
}
