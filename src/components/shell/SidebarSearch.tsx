'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2, AlertCircle } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

export interface CommitmentSearchResult {
  commitmentId: string
  ownerAddress: string
  asset: string
  amount: string
  status: string
  riskType: string
  complianceScore: number
}

export interface SidebarSearchProps {
  ownerAddress?: string
  isCollapsed?: boolean
  onResultSelect?: () => void
}

export const SidebarSearch: React.FC<SidebarSearchProps> = ({
  ownerAddress,
  isCollapsed = false,
  onResultSelect,
}) => {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CommitmentSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 350)

  const fetchResults = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !ownerAddress) {
        setResults([])
        setIsOpen(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          ownerAddress,
          asset: searchQuery.toUpperCase(),
          pageSize: '5',
        })
        const res = await fetch(`/api/commitments/search?${params.toString()}`)
        if (!res.ok) throw new Error('Search failed')
        const json = await res.json()
        const data: CommitmentSearchResult[] = json?.data ?? []
        setResults(data)
        setIsOpen(true)
        setActiveIndex(-1)
      } catch {
        setError('Search unavailable. Please try again.')
        setResults([])
        setIsOpen(false)
      } finally {
        setIsLoading(false)
      }
    },
    [ownerAddress],
  )

  useEffect(() => {
    fetchResults(debouncedQuery)
  }, [debouncedQuery, fetchResults])

  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setError(null)
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  const handleSelect = (item: CommitmentSearchResult) => {
    router.push(`/commitments/${item.commitmentId}`)
    setQuery('')
    setResults([])
    setIsOpen(false)
    onResultSelect?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && results[activeIndex]) {
          handleSelect(results[activeIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setActiveIndex(-1)
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (isCollapsed) {
    return (
      <button
        onClick={() => inputRef.current?.focus()}
        className="w-full flex justify-center px-3 py-2.5 text-white/50 hover:text-white/80 transition-colors"
        aria-label="Open search"
        title="Search commitments"
      >
        <Search size={20} />
      </button>
    )
  }

  const listboxId = 'sidebar-search-listbox'
  const hasResults = results.length > 0
  const isEmpty = !isLoading && !error && query.trim().length > 0 && debouncedQuery === query && !hasResults

  return (
    <div ref={containerRef} className="relative px-2 py-2" data-testid="sidebar-search">
      <div
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen && hasResults}
        aria-owns={listboxId}
        className="relative flex items-center"
      >
        <span className="absolute left-3 text-white/40 pointer-events-none" aria-hidden="true">
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
        </span>

        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          aria-label="Search commitments"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `sidebar-search-option-${activeIndex}` : undefined
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => hasResults && setIsOpen(true)}
          placeholder="Search commitments…"
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#0FF0FC]/40 focus:bg-white/8 transition-colors"
          autoComplete="off"
          spellCheck={false}
        />

        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 text-white/40 hover:text-white/80 transition-colors"
            aria-label="Clear search"
            tabIndex={-1}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="mt-1 flex items-center gap-2 px-3 py-2 text-xs text-red-400 bg-red-400/10 rounded-lg border border-red-400/20"
        >
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div
          role="status"
          aria-live="polite"
          className="mt-1 px-3 py-2 text-xs text-white/40 text-center"
        >
          No commitments found
        </div>
      )}

      {/* Results dropdown */}
      {isOpen && hasResults && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="absolute z-50 left-2 right-2 mt-1 bg-[#111318] border border-white/10 rounded-lg shadow-xl overflow-hidden"
        >
          {results.map((item, index) => (
            <li
              key={item.commitmentId}
              id={`sidebar-search-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`
                flex items-center justify-between px-3 py-2.5 cursor-pointer text-sm transition-colors
                ${index === activeIndex
                  ? 'bg-[#0FF0FC]/10 text-[#0FF0FC]'
                  : 'text-white/80 hover:bg-white/5'
                }
              `}
            >
              <span className="font-mono text-xs truncate">{item.commitmentId}</span>
              <span className="ml-2 text-xs text-white/50 flex-shrink-0">{item.asset}</span>
            </li>
          ))}

          {/* Marketplace fallback link */}
          <li
            role="option"
            aria-selected={false}
            className="border-t border-white/10"
          >
            <a
              href={`/marketplace?q=${encodeURIComponent(query)}`}
              className="flex items-center gap-2 px-3 py-2.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
              onClick={() => { setIsOpen(false); onResultSelect?.() }}
            >
              <Search size={12} aria-hidden="true" />
              Search marketplace for &ldquo;{query}&rdquo;
            </a>
          </li>
        </ul>
      )}

      {/* Live region for screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isLoading
          ? 'Searching…'
          : hasResults
            ? `${results.length} result${results.length === 1 ? '' : 's'} found`
            : isEmpty
              ? 'No results found'
              : ''}
      </div>
    </div>
  )
}

export default SidebarSearch
