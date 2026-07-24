'use client'

import { useRouter } from 'next/navigation'
import ErrorLayout from '@/components/ErrorLayout'
import ErrorButton from '@/components/ErrorButton'
import styles from './not-found.module.css'

export default function NotFound() {
  const router = useRouter()

  return (
    <ErrorLayout>
      <div className={styles.container}>
        {/* Large 404 Display */}
        <div className={styles.errorCode}>404</div>

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
              d="M45 45L75 75M75 45L45 75"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className={styles.title}>Page Not Found</h1>
        <p className={styles.description}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Search Bar */}
        <form
          className={styles.searchBox}
          onSubmit={(e) => {
            e.preventDefault()
            const query = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim()
            if (query) {
              router.push(`/marketplace?q=${encodeURIComponent(query)}`)
            }
          }}
        >
          <label htmlFor="not-found-search" className={styles.searchLabel}>
            Search the site
          </label>
          <div className={styles.searchRow}>
            <input
              id="not-found-search"
              type="search"
              name="q"
              placeholder="Search the site..."
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchButton}>
              Search
            </button>
          </div>
        </form>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <ErrorButton href="/">Go Home</ErrorButton>
          <ErrorButton
            variant="secondary"
            onClick={() => router.back()}
          >
            Go Back
          </ErrorButton>
        </div>
      </div>
    </ErrorLayout>
  )
}
