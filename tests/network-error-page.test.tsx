// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NetworkError from '@/app/network-error/page'

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

describe('network error page', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders troubleshooting guidance and recovery actions', () => {
    render(React.createElement(NetworkError))

    expect(screen.getByRole('heading', { level: 1, name: 'Connection Error' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'What you can do:' })).toBeInTheDocument()
    expect(screen.getByText("Check that you're connected to the internet")).toBeInTheDocument()
    expect(screen.getByText('No internet connection detected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
  })

  it('shows retrying status and disables retry while connectivity is being checked', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))

    render(React.createElement(NetworkError))

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(screen.getByText('Checking connection...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retrying...' })).toBeDisabled()
  })

  it('restores the idle status when the connectivity check fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))

    render(React.createElement(NetworkError))

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByText('No internet connection detected')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })
})
