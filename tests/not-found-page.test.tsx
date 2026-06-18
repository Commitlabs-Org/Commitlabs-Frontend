// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotFound from '@/app/not-found'

const routerBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: routerBack,
  }),
}))

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

describe('not found page', () => {
  beforeEach(() => {
    routerBack.mockClear()
  })

  it('renders the 404 message, search input, and recovery links', () => {
    render(React.createElement(NotFound))

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Page Not Found' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search the site...')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
  })

  it('routes back from the secondary recovery button', () => {
    render(React.createElement(NotFound))

    fireEvent.click(screen.getByRole('button', { name: 'Go Back' }))

    expect(routerBack).toHaveBeenCalledTimes(1)
  })

  it('accepts search text in the site search box', () => {
    render(React.createElement(NotFound))

    const search = screen.getByPlaceholderText('Search the site...')
    fireEvent.change(search, { target: { value: 'escrow status' } })

    expect(search).toHaveValue('escrow status')
  })
})
