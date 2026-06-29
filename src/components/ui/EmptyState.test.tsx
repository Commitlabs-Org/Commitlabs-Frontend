/**
 * @vitest-environment happy-dom
 */

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  afterEach(cleanup)

  // ── Rendering ────────────────────────────────────────────────────────────

  it('renders the title', () => {
    render(<EmptyState title="Nothing here yet" />)
    expect(screen.getByText('Nothing here yet')).toBeTruthy()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Try adjusting your filters." />)
    expect(screen.getByText('Try adjusting your filters.')).toBeTruthy()
  })

  it('does not render a description element when omitted', () => {
    render(<EmptyState title="Empty" />)
    expect(screen.queryByText(/Try adjusting/)).toBeNull()
  })

  it('renders a custom icon', () => {
    render(<EmptyState title="Empty" icon={<svg data-testid="icon" />} />)
    expect(screen.getByTestId('icon')).toBeTruthy()
  })

  it('does not render an icon area when omitted', () => {
    const { container } = render(<EmptyState title="Empty" />)
    // No <span> wrapping an icon should exist
    expect(container.querySelector('span')).toBeNull()
  })

  // ── Accessibility ─────────────────────────────────────────────────────────

  it('has role="status" on the root element', () => {
    render(<EmptyState title="No results" />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('sets aria-label to the title on the root element', () => {
    render(<EmptyState title="No commitments found" />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-label')).toBe('No commitments found')
  })

  it('icon wrapper has aria-hidden="true"', () => {
    render(<EmptyState title="Empty" icon={<svg />} />)
    const iconWrapper = screen.getByRole('status').querySelector('span')
    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true')
  })

  // ── CTA – href variant (renders as <a>) ───────────────────────────────────

  it('renders a link CTA when href is provided', () => {
    render(<EmptyState title="Empty" cta={{ label: 'Go home', href: '/' }} />)
    const link = screen.getByRole('link', { name: 'Go home' })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/')
  })

  it('does not render a <button> when href CTA is provided', () => {
    render(<EmptyState title="Empty" cta={{ label: 'Go home', href: '/' }} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('uses custom ariaLabel on link CTA', () => {
    render(
      <EmptyState
        title="Empty"
        cta={{ label: 'Go', href: '/create', ariaLabel: 'Create your first commitment' }}
      />,
    )
    expect(screen.getByRole('link', { name: 'Create your first commitment' })).toBeTruthy()
  })

  // ── CTA – onClick variant (renders as <button>) ───────────────────────────

  it('renders a button CTA when onClick is provided', () => {
    const handler = vi.fn()
    render(<EmptyState title="Empty" cta={{ label: 'Retry', onClick: handler }} />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('calls onClick when button CTA is clicked', () => {
    const handler = vi.fn()
    render(<EmptyState title="Empty" cta={{ label: 'Retry', onClick: handler }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('uses custom ariaLabel on button CTA', () => {
    render(
      <EmptyState
        title="Empty"
        cta={{ label: 'Retry', onClick: vi.fn(), ariaLabel: 'Retry loading listings' }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Retry loading listings' })).toBeTruthy()
  })

  it('does not render a CTA when none is provided', () => {
    render(<EmptyState title="Empty" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  // ── className passthrough ─────────────────────────────────────────────────

  it('applies a custom className to the root element', () => {
    const { container } = render(<EmptyState title="Empty" className="my-custom-class" />)
    expect(container.firstElementChild?.className).toContain('my-custom-class')
  })
})
