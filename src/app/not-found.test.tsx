// @vitest-environment happy-dom

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NotFound from './not-found'

const mockRouterBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockRouterBack,
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

  it('has a search input with placeholder', () => {
    render(<NotFound />)
    
    const searchInput = screen.getByPlaceholderText('Search the site...')
    expect(searchInput).toBeInTheDocument()
    expect(searchInput).toHaveAttribute('type', 'text')
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
