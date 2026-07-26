// @vitest-environment happy-dom

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Error from './error'

describe('Error Page (src/app/error.tsx)', () => {
  it('renders the 500 error page with basic elements', () => {
    const mockReset = vi.fn()
    render(<Error error={new Error('Test error')} reset={mockReset} />)
    
    // Check 500 code, heading, description
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Something Went Wrong/i })).toBeInTheDocument()
    expect(screen.getByText(/We're experiencing technical difficulties/i)).toBeInTheDocument()
  })

  it('displays the error message and digest when provided', () => {
    const mockReset = vi.fn()
    const testError = new Error('Test error message')
    ;(testError as any).digest = 'test-digest-123'
    
    render(<Error error={testError} reset={mockReset} />)
    
    expect(screen.getByText('Test error message')).toBeInTheDocument()
    expect(screen.getByText(/Error ID: test-digest-123/i)).toBeInTheDocument()
  })

  it('shows fallback message when error.message is empty', () => {
    const mockReset = vi.fn()
    const testError = new Error('')
    
    render(<Error error={testError} reset={mockReset} />)
    
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
  })

  it('calls the reset callback when Try Again button is clicked', () => {
    const mockReset = vi.fn()
    render(<Error error={new Error()} reset={mockReset} />)
    
    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }))
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('has a Go Home link that points to /', () => {
    const mockReset = vi.fn()
    render(<Error error={new Error()} reset={mockReset} />)
    
    const goHomeButton = screen.getByRole('link', { name: /Go Home/i })
    expect(goHomeButton).toHaveAttribute('href', '/')
  })

  it('has an external Report Issue link', () => {
    const mockReset = vi.fn()
    render(<Error error={new Error()} reset={mockReset} />)
    
    const reportButton = screen.getByRole('link', { name: /Report Issue/i })
    expect(reportButton).toHaveAttribute('href', 'https://stellar.org/contact')
  })
})
