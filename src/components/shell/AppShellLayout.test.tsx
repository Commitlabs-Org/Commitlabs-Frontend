import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShellLayout } from './AppShellLayout'

vi.mock('./AppSidebar', () => ({
  AppSidebar: () => (
    <nav aria-label="Main navigation">
      <a href="/marketplace">Marketplace</a>
    </nav>
  ),
}))

function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('AppShellLayout skip link', () => {
  beforeEach(() => {
    installMatchMedia()
  })

  it('renders the skip link before sidebar navigation as the first focus target', () => {
    const { container } = render(
      <AppShellLayout>
        <h1>Dashboard</h1>
      </AppShellLayout>,
    )

    const skipLink = screen.getByRole('link', { name: /skip to main content/i })
    const navigation = screen.getByRole('navigation', { name: /main navigation/i })
    const shell = container.firstElementChild

    expect(skipLink).toHaveAttribute('href', '#main-content')
    expect(shell?.firstElementChild).toBe(skipLink)
    expect(skipLink.compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('marks the main landmark as the skip target and keeps it programmatically focusable', () => {
    render(
      <AppShellLayout>
        <h1>Dashboard</h1>
      </AppShellLayout>,
    )

    const main = screen.getByRole('main')

    expect(main).toHaveAttribute('id', 'main-content')
    expect(main).toHaveAttribute('tabindex', '-1')
    expect(main).toHaveClass('focus:outline-none')
  })

  it('moves focus to the main landmark when the skip link target is activated', () => {
    render(
      <AppShellLayout>
        <h1>Dashboard</h1>
      </AppShellLayout>,
    )

    const skipLink = screen.getByRole('link', { name: /skip to main content/i })
    const main = screen.getByRole('main')

    main.scrollIntoView = vi.fn()

    fireEvent.click(skipLink)

    expect(main).toHaveFocus()
    expect(main.scrollIntoView).toHaveBeenCalled()
  })
})
