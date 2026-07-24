// @vitest-environment happy-dom

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NetworkError from './page'

describe('Network Error Page (src/app/network-error/page.tsx)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the network error page with basic elements', () => {
    render(<NetworkError />)
    
    expect(screen.getByRole('heading', { name: /Connection Error/i })).toBeInTheDocument()
    expect(screen.getByText(/Unable to connect to the network/i)).toBeInTheDocument()
    expect(screen.getByText('What you can do:')).toBeInTheDocument()
  })

  it('displays the list of troubleshooting steps', () => {
    render(<NetworkError />)
    
    const steps = [
      'Check that you\'re connected to the internet',
      'Try disabling your VPN or proxy if you\'re using one',
      'Restart your router or mobile connection',
      'Check if other websites are loading',
      'Clear your browser cache and cookies',
    ]
    
    steps.forEach(step => {
      expect(screen.getByText(step)).toBeInTheDocument()
    })
  })

  it('shows "No internet connection detected" status initially', () => {
    render(<NetworkError />)
    
    expect(screen.getByText('No internet connection detected')).toBeInTheDocument()
  })

  it('has a Go Home link that points to /', () => {
    render(<NetworkError />)
    
    const goHomeButton = screen.getByRole('link', { name: /Go Home/i })
    expect(goHomeButton).toHaveAttribute('href', '/')
  })

  it('toggles retry state when Retry button is clicked', async () => {
    // Mock fetch to never resolve
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    
    render(<NetworkError />)
    const retryButton = screen.getByRole('button', { name: /Retry/i })
    
    fireEvent.click(retryButton)
    
    await waitFor(() => {
      expect(screen.getByText('Checking connection...')).toBeInTheDocument()
      expect(retryButton).toBeDisabled()
    })
    
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('reloads the page when fetch is successful', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    
    render(<NetworkError />)
    const retryButton = screen.getByRole('button', { name: /Retry/i })
    
    fireEvent.click(retryButton)
    
    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledTimes(1)
    })
  })

  it('resets retry state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No internet')))
    
    render(<NetworkError />)
    const retryButton = screen.getByRole('button', { name: /Retry/i })
    
    fireEvent.click(retryButton)
    
    await waitFor(() => {
      expect(screen.getByText('No internet connection detected')).toBeInTheDocument()
      expect(retryButton).not.toBeDisabled()
    })
  })
})
