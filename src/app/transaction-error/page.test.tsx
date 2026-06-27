// @vitest-environment happy-dom

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TransactionError from './page'

// Mock next/navigation
const mockRouterBack = vi.fn()
const mockUseRouter = vi.fn()
const mockUseSearchParams = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockRouterBack,
  }),
  useSearchParams: () => mockUseSearchParams(),
}))

// Mock buildExplorerUrl
vi.mock('@/utils/explorerLinks', () => ({
  buildExplorerUrl: (type: string, hash: string | null) => 
    hash ? `https://explorer.example.com/${type}/${hash}` : null,
}))

describe('Transaction Error Page (src/app/transaction-error/page.tsx)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Default search params
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => null,
    })
  })

  it('renders with default failed category when no params are provided', () => {
    render(<TransactionError />)
    
    expect(screen.getByRole('heading', { name: /Transaction Failed/i })).toBeInTheDocument()
  })

  it('renders rejected category when category param is "rejected"', () => {
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => (param === 'category' ? 'rejected' : null),
    })
    
    render(<TransactionError />)
    
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Transaction Rejected/i })).toBeInTheDocument()
  })

  it('renders timed-out category when category param is "timed-out"', () => {
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => (param === 'category' ? 'timed-out' : null),
    })
    
    render(<TransactionError />)
    
    expect(screen.getByText('Timed out')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Transaction Status Unknown/i })).toBeInTheDocument()
  })

  it('maps error codes to correct categories', () => {
    // Test CONFLICT maps to rejected
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => (param === 'code' ? 'CONFLICT' : null),
    })
    const { rerender } = render(<TransactionError />)
    expect(screen.getByText('Rejected')).toBeInTheDocument()

    // Test GATEWAY_TIMEOUT maps to timed-out
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => (param === 'code' ? 'GATEWAY_TIMEOUT' : null),
    })
    rerender(<TransactionError />)
    expect(screen.getByText('Timed out')).toBeInTheDocument()

    // Test INTERNAL_ERROR maps to failed
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => (param === 'code' ? 'INTERNAL_ERROR' : null),
    })
    rerender(<TransactionError />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('displays custom message when "message" param is provided', () => {
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => (param === 'message' ? 'Custom error message' : null),
    })
    
    render(<TransactionError />)
    
    expect(screen.getByText('Custom error message')).toBeInTheDocument()
  })

  it('shows transaction hash and copy button when "hash" param is provided', async () => {
    const testHash = '0x123456789abcdef'
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => (param === 'hash' ? testHash : null),
    })
    
    // Mock clipboard.writeText
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    })
    
    render(<TransactionError />)
    
    expect(screen.getByText('Transaction Hash')).toBeInTheDocument()
    expect(screen.getByText(testHash)).toBeInTheDocument()
    
    const copyButton = screen.getByRole('button', { name: /Copy transaction hash/i })
    expect(copyButton).toBeInTheDocument()
    
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testHash)
  })

  it('shows error code when "code" param is provided', () => {
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => (param === 'code' ? 'USER_REJECTED' : null),
    })
    
    render(<TransactionError />)
    
    expect(screen.getByText('Error Code')).toBeInTheDocument()
    expect(screen.getByText('USER_REJECTED')).toBeInTheDocument()
  })

  it('displays explorer link when hash is provided for timed-out category', () => {
    const testHash = '0xabc123'
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => {
        if (param === 'category') return 'timed-out'
        if (param === 'hash') return testHash
        return null
      },
    })
    
    render(<TransactionError />)
    
    const explorerButton = screen.getByRole('link', { name: /Check Explorer/i })
    expect(explorerButton).toHaveAttribute('href', 'https://explorer.example.com/tx/0xabc123')
  })

  it('calls router.back() when Try Again button is clicked', () => {
    render(<TransactionError />)
    
    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }))
    expect(mockRouterBack).toHaveBeenCalledTimes(1)
  })

  it('has a Go to Dashboard link pointing to /commitments/overview', () => {
    render(<TransactionError />)
    
    const dashboardLink = screen.getByRole('link', { name: /Go to Dashboard/i })
    expect(dashboardLink).toHaveAttribute('href', '/commitments/overview')
  })

  it('renders tips specific to the category', () => {
    mockUseSearchParams.mockReturnValue({
      get: (param: string) => (param === 'category' ? 'rejected' : null),
    })
    
    render(<TransactionError />)
    
    expect(screen.getByText('Confirm the wallet signature prompt was approved.')).toBeInTheDocument()
    expect(screen.getByText('Check the amount, maturity date, and commitment state.')).toBeInTheDocument()
  })
})
