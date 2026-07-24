// @vitest-environment happy-dom

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NotFound from './not-found'

const mockRouterBack = vi.fn()
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockRouterBack,
    push: mockRouterPush,
  }),
}))

describe('404 Not Found Page (src/app/not-found.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the 404 page with basic elements', () => {
    render(<NotFound />)

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Page Not Found/i })).toBeInTheDocument()
    expect(screen.getByText(/doesn't exist or has been moved/i)).toBeInTheDocument()
  })

  it('has a search input with placeholder and type=search', () => {
    render(<NotFound />)

    const searchInput = screen.getByPlaceholderText('Search the site...')
    expect(searchInput).toBeInTheDocument()
    expect(searchInput).toHaveAttribute('type', 'search')
  })

  it('has an accessible label for the search input', () => {
    render(<NotFound />)

    // getByLabelText confirms the <label> is properly associated via htmlFor
    expect(screen.getByLabelText(/search the site/i)).toBeInTheDocument()
  })

  it('navigates to /marketplace?q= when a query is submitted', () => {
    render(<NotFound />)

    const searchInput = screen.getByLabelText(/search the site/i)
    fireEvent.change(searchInput, { target: { value: 'escrow status' } })
    fireEvent.submit(searchInput.closest('form')!)

    expect(mockRouterPush).toHaveBeenCalledWith('/marketplace?q=escrow%20status')
  })

  it('does not navigate when the search query is blank', () => {
    render(<NotFound />)

    fireEvent.submit(screen.getByLabelText(/search the site/i).closest('form')!)

    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('has a Go Home link that points to /', () => {
    render(<NotFound />)

    const goHomeButton = screen.getByRole('link', { name: /Go Home/i })
    expect(goHomeButton).toHaveAttribute('href', '/')
  })

  it('calls router.back() when Go Back button is clicked', () => {
    render(<NotFound />)

    fireEvent.click(screen.getByRole('button', { name: /Go Back/i }))
    expect(mockRouterBack).toHaveBeenCalledTimes(1)
  })
})
