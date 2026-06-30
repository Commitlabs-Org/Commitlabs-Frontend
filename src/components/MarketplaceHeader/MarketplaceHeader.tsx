'use client'

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, ArrowLeft, Loader2, Search } from 'lucide-react'
import styles from './MarketplaceHeader.module.css';
import { apiGet, apiFetch } from '@/lib/apiClient';
import { MarketStatsBanner } from './MarketStatsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommitmentSearchResult {
  commitmentId: string
  ownerAddress: string
  asset: string
  amount: string
  status: string
  riskType: string
  complianceScore: number
  currentValue: string
  createdAt: string
  expiresAt: string
}

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'priceLow', label: 'Price: Low to High' },
  { value: 'priceHigh', label: 'Price: High to Low' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']

export interface MarketplaceHeaderProps {
  /** Called (debounced) whenever the search query changes. */
  onSearchChange?: (query: string) => void
  /** Debounce delay in ms. Default 300. */
  searchDebounceMs?: number
  /** Placeholder text for the search input. */
  searchPlaceholder?: string
  /** URL for the back link. Default "/". */
  backHref?: string
  /** URL for the Create button. Default "/create". */
  createHref?: string
  /** Optional controlled initial query value. */
  searchQuery?: string
  /**
   * Owner address forwarded to /api/commitments/search.
   * When omitted requests will receive a 400 validation error (handled gracefully).
   */
  ownerAddress?: string
  /** Called when the user selects a result from the dropdown. */
  onResultSelect?: (item: CommitmentSearchResult) => void
}

const DEFAULT_PLACEHOLDER = 'Search commitmentsâ€¦'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarketplaceHeader({
  onSearchChange,
  searchDebounceMs = 300,
  searchPlaceholder = DEFAULT_PLACEHOLDER,
  backHref = '/',
  createHref = '/create',
  searchQuery: controlledQuery,
}: MarketplaceHeaderProps) {
  // ── Sort ───────────────────────────────────────────────────────────────────
  const [sortValue, setSortValue] = useState<SortValue>('popular')

  // â”€â”€ Typeahead â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [query, setQuery] = useState(controlledQuery ?? '')
  const [results, setResults] = useState<CommitmentSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uid = useId()
  const listboxId = `${uid}-listbox`

  // ── Debounced typeahead search ─────────────────────────────────────────────
  useEffect(() => {
    const trimmed = query.trim()

    if (!trimmed) {
      abortRef.current?.abort()
      setResults([])
      setIsDropdownOpen(false)
      setActiveIndex(-1)
      onSearchChange?.('')
      return
    }

    const timerId = window.setTimeout(() => {
      // Cancel any in-flight request before starting the next one.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsSearching(true)
      setSearchError(null)

      const params = new URLSearchParams({
        ownerAddress: ownerAddress ?? 'marketplace',
        asset: trimmed,
      })

      apiFetch<{ data?: CommitmentSearchResult[] }>(`/api/commitments/search?${params}`, { signal: controller.signal })
          .then((data) => {
            setResults(data.data ?? []);
            setIsDropdownOpen(true);
            setActiveIndex(-1);
            setIsSearching(false);
          })
          .catch((err: any) => {
            if (err.name !== 'AbortError') {
              setSearchError(err.message || String(err));
              setIsDropdownOpen(false);
              setIsSearching(false);
            }
          })

      onSearchChange?.(trimmed)
    }, searchDebounceMs)

    return () => clearTimeout(timerId)
  }, [query, searchDebounceMs, ownerAddress, onSearchChange])

  // â”€â”€ Keyboard navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSelect = useCallback(
    (item: CommitmentSearchResult) => {
      setQuery(item.asset)
      setIsDropdownOpen(false)
      setActiveIndex(-1)
      onResultSelect?.(item)
      onSearchChange?.(item.asset)
    },
    [onResultSelect, onSearchChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isDropdownOpen) return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((i) => Math.min(i + 1, results.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (activeIndex >= 0 && results[activeIndex]) {
            handleSelect(results[activeIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsDropdownOpen(false)
          setActiveIndex(-1)
          break
      }
    },
    [isDropdownOpen, results, activeIndex, handleSelect],
  )

  const handleBlur = useCallback(() => {
    // Small delay so a mousedown on an option fires before the input blurs.
    const id = window.setTimeout(() => {
      setIsDropdownOpen(false)
      setActiveIndex(-1)
    }, 150)
    return () => clearTimeout(id)
  }, [])

  const activeDescendant =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <header className={styles.root} role="banner">
      <div className={styles.inner}>
        {/* Left: branding */}
        <div className={styles.contentBlock}>
          <Link href={backHref} className={styles.backLink} aria-label="Back to Home">
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

        {/* Right: controls */}
        <div className={styles.controlsBlock}>
          {/* â”€â”€ Typeahead combobox â”€â”€ */}
          <div className={styles.searchWrap}>
            <label htmlFor="marketplace-search" className={styles.srOnly}>
              Search commitments
            </label>
            <Search className={styles.searchIcon} aria-hidden width={18} height={18} />

            <input
              ref={inputRef}
              id="marketplace-search"
              role="combobox"
              type="search"
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (results.length > 0) setIsDropdownOpen(true)
              }}
              onBlur={handleBlur}
              aria-label="Search commitments"
              aria-autocomplete="list"
              aria-expanded={isDropdownOpen}
              aria-controls={listboxId}
              aria-activedescendant={activeDescendant}
              aria-busy={isSearching}
              autoComplete="off"
            />

            {/* Spinner while fetching */}
            {isSearching && (
              <span className={styles.searchSpinner} aria-hidden>
                <Loader2 size={14} className={styles.spinnerIcon} />
              </span>
            )}

            {/* Results listbox â€“ always rendered so aria-controls is valid */}
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Search results"
              className={`${styles.dropdown} ${isDropdownOpen ? styles.dropdownVisible : ''}`}
              hidden={!isDropdownOpen}
            >
              {results.length === 0 ? (
                <li
                  role="option"
                  aria-selected={false}
                  className={styles.dropdownEmpty}
                >
                  No results found
                </li>
              ) : (
                results.map((item, i) => (
                  <li
                    key={item.commitmentId}
                    id={`${listboxId}-option-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    className={`${styles.dropdownItem} ${i === activeIndex ? styles.dropdownItemActive : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(item)}
                  >
                    <span className={styles.dropdownItemAsset}>{item.asset}</span>
                    <span className={styles.dropdownItemMeta}>
                      {item.riskType} Â· {item.amount}
                    </span>
                  </li>
                ))
              )}
            </ul>

            {/* Inline search error */}
            {searchError && !isDropdownOpen && (
              <div className={styles.searchError} role="alert">
                <AlertCircle size={12} aria-hidden />
                {searchError}
              </div>
            )}
          </div>

          {/* ── Stats summary ── */}
          <MarketStatsBanner />

          {/* â”€â”€ Sort control â”€â”€ */}
          <div className={styles.sortControl}>
            <label htmlFor="marketplace-sort" className={styles.srOnly}>
              Sort marketplace
            </label>
            <select
              id="marketplace-sort"
              className={styles.sortSelect}
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value as SortValue)}
              aria-label="Sort marketplace"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* â”€â”€ Create button â”€â”€ */}
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
