// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErrorPage from '@/app/error'

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

describe('app error page', () => {
  it('renders server error details and recovery actions', () => {
    const reset = vi.fn()
    const error = Object.assign(new Error('Database connection failed'), {
      digest: 'ERR-123',
    })

    render(React.createElement(ErrorPage, { error, reset }))

    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Something Went Wrong' })).toBeInTheDocument()
    expect(screen.getByText('Database connection failed')).toBeInTheDocument()
    expect(screen.getByText('Error ID: ERR-123')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Report Issue' })).toHaveAttribute(
      'href',
      'https://stellar.org/contact',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('falls back when an error has no message', () => {
    render(React.createElement(ErrorPage, {
      error: Object.assign(new Error(''), { message: '' }),
      reset: vi.fn(),
    }))

    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
  })
})
