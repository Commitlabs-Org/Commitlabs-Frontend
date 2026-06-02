'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, ArrowLeft } from 'lucide-react'
import styles from './MarketplaceHeader.module.css'

// Types for marketplace stats fetched from the API
interface MarketplaceStats {
  activeListings: number
  averageYield: number // as a percentage
  medianPrice: number // in USD
  // Add other fields if needed
}

// Sort options for the marketplace header
const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'priceLow', label: 'Price: Low to High' },
  { value: 'priceHigh', label: 'Price: High to Low' },
] as const;

type SortValue = typeof SORT_OPTIONS[number]['value'];

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
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState<SortValue>('popular');

  // Fetch marketplace stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/marketplace/stats');
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        setStats(data);
      } catch (e) {
        setStatsError((e as Error).message);
      }
    };
    fetchStats();
  }, []);

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as SortValue;
    setSortValue(val);
    // TODO: expose sort change via prop if needed
  };
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

          {/* Stats Summary */}
          {stats && (
            <div className={styles.statsSummary} aria-live="polite">
              <span className={styles.statItem}>Listings: {stats.activeListings}</span>
              <span className={styles.statItem}>Avg Yield: {stats.averageYield}%</span>
              <span className={styles.statItem}>Median Price: ${stats.medianPrice}</span>
            </div>
          )}
          {statsError && <div className={styles.error}>Error: {statsError}</div>}

          {/* Sort Control */}
          <div className={styles.sortControl}>
            <label htmlFor="marketplace-sort" className={styles.srOnly}>Sort marketplace</label>
            <select
              id="marketplace-sort"
              className={styles.sortSelect}
              value={sortValue}
              onChange={handleSortChange}
              aria-label="Sort marketplace"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
