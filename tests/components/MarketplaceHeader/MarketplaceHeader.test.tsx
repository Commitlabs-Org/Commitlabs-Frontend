/**
 * @vitest-environment happy-dom
 *
 * Tests for MarketplaceHeader typeahead search:
 * debounce, AbortController cancellation, result rendering, empty state,
 * keyboard navigation, error handling, and combobox accessibility.
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { MarketplaceHeader } from '../../../src/components/MarketplaceHeader/MarketplaceHeader'

// ---------------------------------------------------------------------------
// Module mocks (must be at module scope)
// ---------------------------------------------------------------------------

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, ...rest }, children),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, ...rest }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) =>
    React.createElement('img', { src, alt, width, height, ...rest }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STATS_RESPONSE = { activeListings: 12, averageYield: 5.2, medianPrice: 1500 }

const makeResult = (i: number) => ({
  commitmentId: `cmt-${i}`,
  ownerAddress: `G${'A'.repeat(55)}`,
  asset: i % 2 === 0 ? 'XLM' : 'USDC',
  amount: `${i * 1000}`,
  status: 'ACTIVE',
  riskType: 'Safe',
  complianceScore: 90,
  currentValue: `${i * 1000}`,
  createdAt: '2024-01-01T00:00:00Z',
  expiresAt: '2024-06-01T00:00:00Z',
})

const SEARCH_RESULTS = [makeResult(1), makeResult(2), makeResult(3)]

/**
 * Default fetch mock. Returns Promises that resolve synchronously (next
 * microtask tick) so that `await act(async () => { ... })` flushes them.
 */
function mockFetch(opts?: {
  statsOk?: boolean
  searchResults?: typeof SEARCH_RESULTS
  searchOk?: boolean
  /** If true the search Promise never settles (used to test loading state). */
  searchHangs?: boolean
}) {
  const {
    statsOk = true,
    searchResults = SEARCH_RESULTS,
    searchOk = true,
    searchHangs = false,
  } = opts ?? {}

  ;(global.fetch as Mock).mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/api/marketplace/stats')) {
      if (!statsOk) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'fail' }) })
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(STATS_RESPONSE) })
    }

    if (url.includes('/api/commitments/search')) {
      if (searchHangs) {
        // Return a Promise that can only be rejected via the AbortSignal.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }))
          })
        })
      }

      if (!searchOk) {
        return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'bad' }) })
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: searchResults }),
      })
    }

    return Promise.reject(new Error(`Unmocked URL: ${url}`))
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getInput = () => screen.getByRole('combobox', { name: /Search commitments/i })

/** Returns only the options inside the typeahead listbox, not the sort <select>. */
const getOptions = () => {
  const input = screen.queryByRole('combobox', { name: /Search commitments/i })
  if (!input) return []
  const listboxId = input.getAttribute('aria-controls')
  if (!listboxId) return []
  const listbox = document.getElementById(listboxId)
  if (!listbox) return []
  return Array.from(listbox.querySelectorAll('[role="option"]')) as HTMLElement[]
}

/**
 * Type into the search input and advance fake timers so the debounce fires,
 * then await act() to flush the resulting Promise chain.
 */
async function typeAndWait(text: string, debounceMs = 300) {
  fireEvent.change(getInput(), { target: { value: text } })
  await act(async () => { vi.advanceTimersByTime(debounceMs) })
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MarketplaceHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn()
    mockFetch()
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ── Initial render ────────────────────────────────────────────────────────

  describe('initial rendering', () => {
    it('renders the search input with role="combobox"', () => {
      render(<MarketplaceHeader />)
      expect(getInput()).toBeInTheDocument()
    })

    it('combobox starts with aria-expanded="false"', () => {
      render(<MarketplaceHeader />)
      expect(getInput()).toHaveAttribute('aria-expanded', 'false')
    })

    it('combobox has aria-autocomplete="list"', () => {
      render(<MarketplaceHeader />)
      expect(getInput()).toHaveAttribute('aria-autocomplete', 'list')
    })

    it('combobox has aria-controls pointing to a listbox element', () => {
      render(<MarketplaceHeader />)
      const input = getInput()
      const listboxId = input.getAttribute('aria-controls')
      expect(listboxId).toBeTruthy()
      expect(document.getElementById(listboxId!)).toBeInTheDocument()
      expect(document.getElementById(listboxId!)?.getAttribute('role')).toBe('listbox')
    })

    it('renders the sort select', () => {
      render(<MarketplaceHeader />)
      expect(screen.getByRole('combobox', { name: /Sort marketplace/i })).toBeInTheDocument()
    })

    it('renders the Create link', () => {
      render(<MarketplaceHeader />)
      expect(screen.getByRole('link', { name: /Create commitment/i })).toBeInTheDocument()
    })

    it('applies controlled initial query when searchQuery prop is provided', () => {
      render(<MarketplaceHeader searchQuery="XLM" />)
      expect(getInput()).toHaveValue('XLM')
    })
  })

  // ── Stats fetch ───────────────────────────────────────────────────────────

  describe('stats', () => {
    it('fetches and displays stats after mount', async () => {
      render(<MarketplaceHeader />)
      // Flush the stats fetch promise chain
      await act(async () => {})
      expect(screen.getByText(/Listings: 12/)).toBeInTheDocument()
      expect(screen.getByText(/Avg Yield: 5\.2%/)).toBeInTheDocument()
      expect(screen.getByText(/Median Price: \$1500/)).toBeInTheDocument()
    })

    it('shows error message when stats fetch fails', async () => {
      mockFetch({ statsOk: false })
      render(<MarketplaceHeader />)
      await act(async () => {})
      expect(screen.getByText(/Error:/)).toBeInTheDocument()
    })
  })

  // ── Debounce ──────────────────────────────────────────────────────────────

  describe('debounce', () => {
    it('does not call fetch for an empty query', async () => {
      render(<MarketplaceHeader />)
      fireEvent.change(getInput(), { target: { value: '' } })
      await act(async () => { vi.advanceTimersByTime(500) })
      const searchCalls = (global.fetch as Mock).mock.calls.filter((c) =>
        String(c[0]).includes('commitments/search'),
      )
      expect(searchCalls).toHaveLength(0)
    })

    it('does not call fetch for whitespace-only input', async () => {
      render(<MarketplaceHeader />)
      fireEvent.change(getInput(), { target: { value: '   ' } })
      await act(async () => { vi.advanceTimersByTime(500) })
      expect(
        (global.fetch as Mock).mock.calls.filter((c) =>
          String(c[0]).includes('commitments/search'),
        ),
      ).toHaveLength(0)
    })

    it('does not fetch before the debounce delay has elapsed', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      fireEvent.change(getInput(), { target: { value: 'XL' } })
      await act(async () => { vi.advanceTimersByTime(150) })
      expect(
        (global.fetch as Mock).mock.calls.filter((c) =>
          String(c[0]).includes('commitments/search'),
        ),
      ).toHaveLength(0)
    })

    it('fires exactly one fetch after the debounce delay', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await typeAndWait('XLM', 300)
      expect(
        (global.fetch as Mock).mock.calls.filter((c) =>
          String(c[0]).includes('commitments/search'),
        ),
      ).toHaveLength(1)
    })

    it('calls onSearchChange with the trimmed query after debounce', async () => {
      const onSearchChange = vi.fn()
      render(<MarketplaceHeader onSearchChange={onSearchChange} searchDebounceMs={300} />)
      await typeAndWait(' XLM ', 300)
      expect(onSearchChange).toHaveBeenCalledWith('XLM')
    })

    it('resets to no dropdown when query is cleared', async () => {
      render(<MarketplaceHeader />)
      await typeAndWait('XLM', 300)
      expect(getInput()).toHaveAttribute('aria-expanded', 'true')

      fireEvent.change(getInput(), { target: { value: '' } })
      await act(async () => { vi.advanceTimersByTime(300) })
      expect(getInput()).toHaveAttribute('aria-expanded', 'false')
    })
  })

  // ── Request cancellation ──────────────────────────────────────────────────

  describe('request cancellation', () => {
    it('aborts the previous in-flight request when the query changes rapidly', async () => {
      const abortedSignals: boolean[] = []

      ;(global.fetch as Mock).mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/marketplace/stats')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(STATS_RESPONSE) })
        }
        init?.signal?.addEventListener('abort', () => { abortedSignals.push(true) })
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }))
          })
        })
      })

      render(<MarketplaceHeader searchDebounceMs={100} />)

      fireEvent.change(getInput(), { target: { value: 'XL' } })
      await act(async () => { vi.advanceTimersByTime(100) })

      // Second query cancels the first before it resolves
      fireEvent.change(getInput(), { target: { value: 'XLM' } })
      await act(async () => { vi.advanceTimersByTime(100) })

      expect(abortedSignals.length).toBeGreaterThan(0)
    })
  })

  // ── Results display ───────────────────────────────────────────────────────

  describe('results display', () => {
    it('shows results in the dropdown after a successful search', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await typeAndWait('XLM', 300)
      expect(getOptions().length).toBeGreaterThan(0)
    })

    it('renders one option per result', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await typeAndWait('XLM', 300)
      expect(getOptions()).toHaveLength(SEARCH_RESULTS.length)
    })

    it('displays asset and meta text in each option', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await typeAndWait('XLM', 300)
      const options = getOptions()
      expect(options[0].textContent).toContain(SEARCH_RESULTS[0].asset)
      expect(options[0].textContent).toContain(SEARCH_RESULTS[0].riskType)
    })

    it('shows an empty-results option when the API returns an empty array', async () => {
      mockFetch({ searchResults: [] })
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await typeAndWait('UNKNOWN', 300)
      // Empty-state message is rendered inside the (now open) listbox
      const listboxId = getInput().getAttribute('aria-controls')!
      expect(document.getElementById(listboxId)?.textContent).toContain('No results found')
    })

    it('sets aria-expanded=true when the dropdown is open', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await typeAndWait('XLM', 300)
      expect(getInput()).toHaveAttribute('aria-expanded', 'true')
    })

    it('shows loading spinner (aria-busy) while search is in flight', async () => {
      mockFetch({ searchHangs: true })
      render(<MarketplaceHeader searchDebounceMs={300} />)
      // Change the query first so the debounce timer is scheduled
      fireEvent.change(getInput(), { target: { value: 'XLM' } })
      // Advance past the debounce; fetch is called but never resolves
      await act(async () => { vi.advanceTimersByTime(300) })
      expect(getInput()).toHaveAttribute('aria-busy', 'true')
    })

    it('closes the dropdown and clears results when query is emptied', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await typeAndWait('XLM', 300)
      expect(getInput()).toHaveAttribute('aria-expanded', 'true')

      fireEvent.change(getInput(), { target: { value: '' } })
      await act(async () => { vi.advanceTimersByTime(300) })
      expect(getInput()).toHaveAttribute('aria-expanded', 'false')
    })
  })

  // ── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('shows an inline error alert when the search request fails', async () => {
      mockFetch({ searchOk: false })
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await typeAndWait('XLM', 300)
      const alert = screen.queryByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert?.textContent).toContain('Search failed')
    })

    it('does not show an error when the request is cancelled (AbortError)', async () => {
      ;(global.fetch as Mock).mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/marketplace/stats')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(STATS_RESPONSE) })
        }
        const err = Object.assign(new Error('AbortError'), { name: 'AbortError' })
        return Promise.reject(err)
      })

      render(<MarketplaceHeader searchDebounceMs={100} />)
      await typeAndWait('XLM', 100)
      await act(async () => {})
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  // ── Keyboard navigation ───────────────────────────────────────────────────

  describe('keyboard navigation', () => {
    async function openDropdown() {
      await typeAndWait('XLM', 300)
      expect(getOptions().length).toBeGreaterThan(0)
    }

    it('ArrowDown moves focus to the first option', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await openDropdown()

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' })
      expect(getOptions()[0]).toHaveAttribute('aria-selected', 'true')
    })

    it('ArrowDown does not advance past the last option', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await openDropdown()

      const n = SEARCH_RESULTS.length
      for (let i = 0; i < n + 5; i++) {
        fireEvent.keyDown(getInput(), { key: 'ArrowDown' })
      }
      expect(getOptions()[n - 1]).toHaveAttribute('aria-selected', 'true')
    })

    it('ArrowUp moves focus back to the previous option', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await openDropdown()

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' })
      fireEvent.keyDown(getInput(), { key: 'ArrowDown' })
      fireEvent.keyDown(getInput(), { key: 'ArrowUp' })
      expect(getOptions()[0]).toHaveAttribute('aria-selected', 'true')
    })

    it('ArrowUp does not move past index 0', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await openDropdown()

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' })
      fireEvent.keyDown(getInput(), { key: 'ArrowUp' })
      fireEvent.keyDown(getInput(), { key: 'ArrowUp' })
      expect(getOptions()[0]).toHaveAttribute('aria-selected', 'true')
    })

    it('active option id is reflected in aria-activedescendant', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await openDropdown()

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' })
      const activeDescendant = getInput().getAttribute('aria-activedescendant')
      expect(activeDescendant).toBeTruthy()
      expect(document.getElementById(activeDescendant!)).toBeInTheDocument()
    })

    it('Enter selects the active option and calls onResultSelect', async () => {
      const onResultSelect = vi.fn()
      render(<MarketplaceHeader searchDebounceMs={300} onResultSelect={onResultSelect} />)
      await openDropdown()

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' })
      fireEvent.keyDown(getInput(), { key: 'Enter' })

      expect(onResultSelect).toHaveBeenCalledTimes(1)
      expect(onResultSelect).toHaveBeenCalledWith(
        expect.objectContaining({ commitmentId: SEARCH_RESULTS[0].commitmentId }),
      )
    })

    it('Enter on active option closes the dropdown', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await openDropdown()

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' })
      fireEvent.keyDown(getInput(), { key: 'Enter' })

      expect(getInput()).toHaveAttribute('aria-expanded', 'false')
    })

    it('Escape closes the dropdown without selecting', async () => {
      const onResultSelect = vi.fn()
      render(<MarketplaceHeader searchDebounceMs={300} onResultSelect={onResultSelect} />)
      await openDropdown()

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' })
      fireEvent.keyDown(getInput(), { key: 'Escape' })

      expect(getInput()).toHaveAttribute('aria-expanded', 'false')
      expect(onResultSelect).not.toHaveBeenCalled()
    })
  })

  // ── Mouse interaction ─────────────────────────────────────────────────────

  describe('mouse interaction', () => {
    async function openDropdown() {
      await typeAndWait('XLM', 300)
      expect(getOptions().length).toBeGreaterThan(0)
    }

    it('clicking a result calls onResultSelect with the item', async () => {
      const onResultSelect = vi.fn()
      render(<MarketplaceHeader searchDebounceMs={300} onResultSelect={onResultSelect} />)
      await openDropdown()

      fireEvent.click(getOptions()[1])
      expect(onResultSelect).toHaveBeenCalledWith(
        expect.objectContaining({ commitmentId: SEARCH_RESULTS[1].commitmentId }),
      )
    })

    it('clicking a result closes the dropdown', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await openDropdown()

      fireEvent.click(getOptions()[0])
      expect(getInput()).toHaveAttribute('aria-expanded', 'false')
    })

    it('clicking a result sets the input value to the asset', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await openDropdown()

      const chosen = SEARCH_RESULTS[0]
      fireEvent.click(getOptions()[0])
      expect(getInput()).toHaveValue(chosen.asset)
    })
  })

  // ── Blur handling ─────────────────────────────────────────────────────────

  describe('blur handling', () => {
    async function openDropdown() {
      await typeAndWait('XLM', 300)
      expect(getOptions().length).toBeGreaterThan(0)
    }

    it('closes the dropdown when the input loses focus', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await openDropdown()

      fireEvent.blur(getInput())
      await act(async () => { vi.advanceTimersByTime(200) })
      expect(getInput()).toHaveAttribute('aria-expanded', 'false')
    })

    it('reopens the dropdown on focus when results are available', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await openDropdown()

      fireEvent.blur(getInput())
      await act(async () => { vi.advanceTimersByTime(200) })

      fireEvent.focus(getInput())
      expect(getInput()).toHaveAttribute('aria-expanded', 'true')
    })
  })

  // ── ownerAddress forwarding ───────────────────────────────────────────────

  describe('ownerAddress forwarding', () => {
    it('includes ownerAddress in the search query string when provided', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} ownerAddress="GACCOUNT123" />)
      await typeAndWait('XLM', 300)

      const searchCalls = (global.fetch as Mock).mock.calls.filter((c) =>
        String(c[0]).includes('commitments/search'),
      )
      expect(searchCalls.length).toBeGreaterThan(0)
      expect(String(searchCalls[0][0])).toContain('ownerAddress=GACCOUNT123')
    })

    it('falls back to "marketplace" as ownerAddress when prop is omitted', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await typeAndWait('XLM', 300)

      const searchCalls = (global.fetch as Mock).mock.calls.filter((c) =>
        String(c[0]).includes('commitments/search'),
      )
      expect(String(searchCalls[0][0])).toContain('ownerAddress=marketplace')
    })
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('URL-encodes special characters in the search query', async () => {
      render(<MarketplaceHeader searchDebounceMs={300} />)
      await typeAndWait('XLM & USDC', 300)

      const searchCalls = (global.fetch as Mock).mock.calls.filter((c) =>
        String(c[0]).includes('commitments/search'),
      )
      expect(searchCalls.length).toBeGreaterThan(0)
      expect(String(searchCalls[0][0])).not.toContain('XLM & USDC')
    })
  })

  // ── Accessibility ─────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('header has role="banner"', () => {
      render(<MarketplaceHeader />)
      expect(screen.getByRole('banner')).toBeInTheDocument()
    })

    it('listbox is always present in the DOM (aria-controls stays valid)', () => {
      render(<MarketplaceHeader />)
      const listboxId = getInput().getAttribute('aria-controls')!
      expect(document.getElementById(listboxId)).toBeInTheDocument()
      expect(document.getElementById(listboxId)?.getAttribute('role')).toBe('listbox')
    })

    it('input does not expose aria-activedescendant when no item is active', () => {
      render(<MarketplaceHeader />)
      expect(getInput()).not.toHaveAttribute('aria-activedescendant')
    })

    it('sort select has an accessible label', () => {
      render(<MarketplaceHeader />)
      expect(screen.getByRole('combobox', { name: /Sort marketplace/i })).toBeInTheDocument()
    })
  })
})
