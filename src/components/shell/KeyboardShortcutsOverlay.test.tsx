import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShellLayout } from './AppShellLayout'

vi.mock('./AppSidebar', () => ({
  AppSidebar: () => (
    <nav aria-label="Main navigation">
      <a href="/marketplace">Marketplace</a>
    </nav>
  ),
}))

function installMatchMedia(matches = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      }),
      removeEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('KeyboardShortcutsOverlay', () => {
  beforeEach(() => {
    installMatchMedia()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('opens the shortcuts overlay with ? from the app shell', async () => {
    render(
      <AppShellLayout>
        <h1>Dashboard</h1>
      </AppShellLayout>,
    )

    fireEvent.keyDown(window, { key: '?' })

    expect(await screen.findByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument()
    expect(screen.getAllByText('Open command palette')).toHaveLength(2)
    expect(screen.getByText('Show keyboard shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Close overlay or dialog')).toBeInTheDocument()
  })

  it('ignores ? while typing in editable fields', () => {
    render(
      <AppShellLayout>
        <label htmlFor="search">Search</label>
        <input id="search" />
      </AppShellLayout>,
    )

    fireEvent.keyDown(screen.getByLabelText('Search'), { key: '?' })

    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeInTheDocument()
  })

  it('closes with Escape and restores focus to the original trigger', async () => {
    render(
      <AppShellLayout>
        <button type="button">Trigger</button>
      </AppShellLayout>,
    )

    const trigger = screen.getByRole('button', { name: 'Trigger' })
    trigger.focus()

    fireEvent.keyDown(window, { key: '?' })

    const dialog = await screen.findByRole('dialog', { name: /keyboard shortcuts/i })
    expect(dialog).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeInTheDocument()
    })
    expect(trigger).toHaveFocus()
  })

  it('supports Shift+/ keyboard events for layouts that report slash', async () => {
    render(
      <AppShellLayout>
        <h1>Dashboard</h1>
      </AppShellLayout>,
    )

    fireEvent.keyDown(window, { key: '/', shiftKey: true })

    expect(await screen.findByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument()
  })

  it('omits animation classes when reduced motion is preferred', async () => {
    installMatchMedia(true)

    render(
      <AppShellLayout>
        <h1>Dashboard</h1>
      </AppShellLayout>,
    )

    fireEvent.keyDown(window, { key: '?' })

    expect(await screen.findByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument()
    expect(screen.getByTestId('dialog-backdrop')).not.toHaveClass('animate-in')
  })
})
