// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErrorButton from '@/components/ErrorButton'
import ErrorLayout from '@/components/ErrorLayout'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: ReactNode
    className?: string
  }) => React.createElement('a', { href, className }, children),
}))

describe('ErrorLayout', () => {
  it('renders error page content inside the shared layout shell', () => {
    render(
      React.createElement(
        ErrorLayout,
        null,
        React.createElement('h1', null, 'Recoverable error'),
      ),
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Recoverable error' })).toBeInTheDocument()
  })
})

describe('ErrorButton', () => {
  it('renders an internal recovery link', () => {
    render(React.createElement(ErrorButton, { href: '/dashboard' }, 'Dashboard'))

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it('renders an external support link safely', () => {
    render(
      React.createElement(
        ErrorButton,
        {
          href: 'https://stellar.org/contact',
          isExternal: true,
          variant: 'secondary',
        },
        'Report Issue',
      ),
    )

    const link = screen.getByRole('link', { name: 'Report Issue' })
    expect(link).toHaveAttribute('href', 'https://stellar.org/contact')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('calls click handlers for button recovery actions', () => {
    const onClick = vi.fn()

    render(React.createElement(ErrorButton, { onClick }, 'Try Again'))

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('supports disabled recovery buttons', () => {
    const onClick = vi.fn()

    render(React.createElement(ErrorButton, { onClick, disabled: true }, 'Retrying...'))

    const button = screen.getByRole('button', { name: 'Retrying...' })
    expect(button).toBeDisabled()

    fireEvent.click(button)

    expect(onClick).not.toHaveBeenCalled()
  })
})
