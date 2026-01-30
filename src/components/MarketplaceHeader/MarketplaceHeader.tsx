'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, ArrowLeft } from 'lucide-react'
import styles from './MarketplaceHeader.module.css'

export interface MarketplaceHeaderProps {
  /** Debounced callback when search query changes. Called with the current query string. */
  onSearchChange?: (query: string) => void
  /** Debounce delay in ms. Default 300. */
  searchDebounceMs?: number
  /** Optional initial search value (controlled). */
  searchPlaceholder?: string
  /** URL for the back link. Default "/". */
  backHref?: string
  /** URL for the Create button. Default "/create". */
  createHref?: string
   searchQuery?: string
}

const DEFAULT_PLACEHOLDER = 'Search commitments…'

export function MarketplaceHeader({
  onSearchChange,
  searchDebounceMs = 300,
  searchPlaceholder = DEFAULT_PLACEHOLDER,
  backHref = '/',
  createHref = '/create',
}: MarketplaceHeaderProps) {
  const [query, setQuery] = useState('')

  const debouncedNotify = useCallback(() => {
    onSearchChange?.(query)
  }, [onSearchChange, query])

  useEffect(() => {
    if (searchDebounceMs <= 0) {
      debouncedNotify()
      return
    }
    const id = window.setTimeout(debouncedNotify, searchDebounceMs)
    return () => clearTimeout(id)
  }, [query, searchDebounceMs, debouncedNotify])

  return (
    <header className={styles.root} role="banner">
      <div className={styles.inner}>
        <div className={styles.contentBlock}>
          <Link
            href={backHref}
            className={styles.backLink}
            aria-label="Back to Home"
          >
            <ArrowLeft aria-hidden width={16} height={16} />
            Back to Home
          </Link>
          <div className={styles.headingWrap}>
            <span className={styles.headingGlow} aria-hidden />
            <h1 className={styles.title}>Commitment Marketplace</h1>
          </div>
          <p className={styles.subheading}>
            Browse and trade verified liquidity commitments
          </p>
        </div>

        <div className={styles.controlsBlock}>
          <div className={styles.searchWrap}>
            <label htmlFor="marketplace-search" className={styles.srOnly}>
              Search commitments
            </label>
            <Search
              className={styles.searchIcon}
              aria-hidden
              width={18}
              height={18}
            />
            <input
              id="marketplace-search"
              type="search"
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search commitments"
              autoComplete="off"
            />
          </div>
          <Link
            href={createHref}
            className={styles.createButton}
            aria-label="Create commitment"
          >
            <Image
              src="/plus.png"
              alt=""
              width={18}
              height={18}
              className={styles.createButtonIcon}
              aria-hidden
            />
            <span className={styles.createButtonLabel}>Create</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
