// @vitest-environment happy-dom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShellLayout } from './AppShellLayout'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('framer-motion', () => ({
  motion: {
    aside: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <aside {...props}>{children}</aside>
    ),
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('KeyboardShortcutsOverlay', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockMatchMedia()
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    document.body.style.overflow = ''
  })

  it('opens the shortcuts dialog when ? is pressed outside editable fields', () => {
    render(
      <AppShellLayout>
        <button>Dashboard action</button>
      </AppShellLayout>
    )

    fireEvent.keyDown(window, { key: '?' })

    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument()
    expect(screen.getByText('Command palette')).toBeInTheDocument()
    expect(screen.getByText('Open command palette')).toBeInTheDocument()
  })

  it('ignores ? while typing in form controls', () => {
    render(
      <AppShellLayout>
        <label htmlFor="search">Search</label>
        <input id="search" />
      </AppShellLayout>
    )

    const input = screen.getByLabelText('Search')
    input.focus()
    fireEvent.keyDown(input, { key: '?' })

    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeInTheDocument()
  })

  it('closes with Escape and restores focus to the previously focused element', () => {
    vi.useFakeTimers()

    render(
      <AppShellLayout>
        <button>Dashboard action</button>
      </AppShellLayout>
    )

    const trigger = screen.getByRole('button', { name: /dashboard action/i })
    trigger.focus()
    fireEvent.keyDown(window, { key: '?' })

    vi.advanceTimersByTime(100)
    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)

    vi.useRealTimers()
  })
})
