import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidebarSearch } from './SidebarSearch'

// Mock Next.js router
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock useDebounce to return value immediately in tests
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: <T>(value: T) => value,
}))

const mockSearchResults = [
  {
    commitmentId: 'CMT-001',
    ownerAddress: '0xabc',
    asset: 'XLM',
    amount: '1000',
    status: 'ACTIVE',
    riskType: 'Safe',
    complianceScore: 90,
  },
  {
    commitmentId: 'CMT-002',
    ownerAddress: '0xabc',
    asset: 'USDC',
    amount: '500',
    status: 'CREATED',
    riskType: 'Balanced',
    complianceScore: 75,
  },
]

function mockFetchSuccess(results = mockSearchResults) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: results }),
  } as Response)
}

function mockFetchError() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({}),
  } as Response)
}

function mockFetchNetworkError() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

describe('SidebarSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders the search input when not collapsed', () => {
      render(<SidebarSearch />)
      expect(screen.getByRole('searchbox', { name: /search commitments/i })).toBeInTheDocument()
    })

    it('renders a collapsed icon button when isCollapsed is true', () => {
      render(<SidebarSearch isCollapsed={true} />)
      expect(screen.getByRole('button', { name: /open search/i })).toBeInTheDocument()
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    })

    it('renders placeholder text on input', () => {
      render(<SidebarSearch />)
      const input = screen.getByRole('searchbox')
      expect(input).toHaveAttribute('placeholder', 'Search commitments…')
    })

    it('has correct ARIA attributes on combobox container', () => {
      render(<SidebarSearch />)
      const combobox = screen.getByRole('combobox')
      expect(combobox).toHaveAttribute('aria-haspopup', 'listbox')
      expect(combobox).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('Debounced query fires once', () => {
    it('calls fetch once per debounced query value', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })
    })

    it('does not fetch when ownerAddress is not provided', async () => {
      mockFetchSuccess()
      render(<SidebarSearch />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('does not fetch for empty query', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: '' } })
      })

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('Results rendering', () => {
    it('shows results list when search returns data', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      })

      expect(screen.getByText('CMT-001')).toBeInTheDocument()
      expect(screen.getByText('CMT-002')).toBeInTheDocument()
    })

    it('shows marketplace fallback link in results', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByText(/search marketplace for/i)).toBeInTheDocument()
      })
    })

    it('shows asset label next to commitment ID in results', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByText('XLM')).toBeInTheDocument()
        expect(screen.getByText('USDC')).toBeInTheDocument()
      })
    })
  })

  describe('Empty state', () => {
    it('shows no results message when search returns empty array', async () => {
      mockFetchSuccess([])
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'NOTFOUND' } })
      })

      await waitFor(() => {
        expect(screen.getByText(/no commitments found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error state', () => {
    it('shows error message when fetch returns non-ok response', async () => {
      mockFetchError()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText(/search unavailable/i)).toBeInTheDocument()
      })
    })

    it('shows error message when network throws', async () => {
      mockFetchNetworkError()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })
    })
  })

  describe('Clear button', () => {
    it('shows clear button when input has a value', () => {
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      fireEvent.change(input, { target: { value: 'XLM' } })

      expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument()
    })

    it('does not show clear button when input is empty', () => {
      render(<SidebarSearch ownerAddress="0xabc" />)
      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument()
    })

    it('clears search and results when clear button is clicked', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      })

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      fireEvent.click(clearButton)

      expect(input).toHaveValue('')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('resets error state when clear button is clicked', async () => {
      mockFetchError()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      fireEvent.click(clearButton)

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Keyboard navigation', () => {
    it('navigates down through results with ArrowDown', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      })

      fireEvent.keyDown(input, { key: 'ArrowDown' })

      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
    })

    it('navigates up through results with ArrowUp', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      })

      // Go to last item by pressing ArrowUp from start
      fireEvent.keyDown(input, { key: 'ArrowUp' })

      const options = screen.getAllByRole('option')
      // Should wrap to last data result (index length - 1 before marketplace link)
      expect(options[options.length - 2]).toHaveAttribute('aria-selected', 'true')
    })

    it('selects result and navigates on Enter', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      })

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockPush).toHaveBeenCalledWith('/commitments/CMT-001')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('closes dropdown on Escape key', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      })

      fireEvent.keyDown(input, { key: 'Escape' })

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  describe('onResultSelect callback', () => {
    it('calls onResultSelect when a result is clicked', async () => {
      mockFetchSuccess()
      const onResultSelect = vi.fn()
      render(<SidebarSearch ownerAddress="0xabc" onResultSelect={onResultSelect} />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByText('CMT-001')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('CMT-001'))

      expect(onResultSelect).toHaveBeenCalledOnce()
    })
  })

  describe('Accessibility', () => {
    it('has aria-live region for screen reader announcements', () => {
      render(<SidebarSearch />)
      const liveRegion = screen.getAllByRole('status')
      expect(liveRegion.length).toBeGreaterThan(0)
    })

    it('sets aria-activedescendant when navigating results', async () => {
      mockFetchSuccess()
      render(<SidebarSearch ownerAddress="0xabc" />)
      const input = screen.getByRole('searchbox')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XLM' } })
      })

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      })

      fireEvent.keyDown(input, { key: 'ArrowDown' })

      expect(input).toHaveAttribute('aria-activedescendant', 'sidebar-search-option-0')
    })

    it('has aria-controls pointing to listbox id', () => {
      render(<SidebarSearch />)
      const input = screen.getByRole('searchbox')
      expect(input).toHaveAttribute('aria-controls', 'sidebar-search-listbox')
    })

    it('input has aria-autocomplete="list"', () => {
      render(<SidebarSearch />)
      const input = screen.getByRole('searchbox')
      expect(input).toHaveAttribute('aria-autocomplete', 'list')
    })
  })
})
