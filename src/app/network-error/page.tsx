'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import ErrorLayout from '@/components/ErrorLayout'
import ErrorButton from '@/components/ErrorButton'
import styles from './page.module.css'

export default function NetworkError() {
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    try {
      // Try a simple fetch to check connectivity
      const response = await fetch('/', { method: 'HEAD' })
      if (response.ok) {
        window.location.reload()
      }
    } catch {
      // Network still unavailable
      setIsRetrying(false)
    }
  }, [])

  return (
    <ErrorLayout>
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
              d="M30 60H90M60 30V90M45 75L75 45M75 75L45 45"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className={styles.title}>Connection Error</h1>
        <p className={styles.description}>
          Unable to connect to the network. Please check your internet connection and try again.
        </p>

        {/* Network Check Instructions */}
        <div className={styles.instructions}>
          <h2 className={styles.instructionsTitle}>What you can do:</h2>
          <ul className={styles.instructionsList}>
            <li>Check that you're connected to the internet</li>
            <li>Try disabling your VPN or proxy if you're using one</li>
            <li>Restart your router or mobile connection</li>
            <li>Check if other websites are loading</li>
            <li>Clear your browser cache and cookies</li>
          </ul>
        </div>

        {/* Status Indicator */}
        <div className={styles.statusBox}>
          <div className={styles.statusDot} />
          <span className={styles.statusText}>
            {isRetrying ? 'Checking connection...' : 'No internet connection detected'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <ErrorButton
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </ErrorButton>
          <ErrorButton href="/" variant="secondary">
            Go Home
          </ErrorButton>
        </div>
      </div>
    </ErrorLayout>
  )
}
