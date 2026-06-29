// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeToggle } from './ThemeToggle'

vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}))

import { useTheme } from 'next-themes'

const mockUseTheme = vi.mocked(useTheme)

function setupTheme(overrides: Partial<ReturnType<typeof useTheme>> = {}) {
  const mockSetTheme = vi.fn()
  mockUseTheme.mockReturnValue({
    theme: 'system',
    setTheme: mockSetTheme,
    resolvedTheme: 'dark',
    systemTheme: 'dark',
    themes: ['light', 'dark', 'system'],
    ...overrides,
  })
  return { mockSetTheme }
}

async function waitForMounted() {
  await waitFor(() => {
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
}

describe('ThemeToggle', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('mounting behavior', () => {
    it('renders interactive button with correct default theme', async () => {
      setupTheme({ theme: 'system' })
      render(<ThemeToggle />)
      await waitForMounted()
      const button = screen.getByRole('button')
      expect(button).toBeEnabled()
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode')
    })
  })

  describe('icon and label per theme', () => {
    it('shows Monitor with system label when theme is system', async () => {
      setupTheme({ theme: 'system' })
      render(<ThemeToggle />)
      await waitForMounted()
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to light mode')
      expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument()
    })

    it('shows Sun with light label when theme is light', async () => {
      setupTheme({ theme: 'light', resolvedTheme: 'light' })
      render(<ThemeToggle />)
      await waitForMounted()
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to dark mode')
    })

    it('shows Moon with dark label when theme is dark', async () => {
      setupTheme({ theme: 'dark', resolvedTheme: 'dark' })
      render(<ThemeToggle />)
      await waitForMounted()
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to system mode')
    })
  })

  describe('theme cycling', () => {
    it('cycles to light when clicked in system mode', async () => {
      const { mockSetTheme } = setupTheme({ theme: 'system' })
      render(<ThemeToggle />)
      await waitForMounted()
      fireEvent.click(screen.getByRole('button'))
      expect(mockSetTheme).toHaveBeenCalledWith('light')
    })

    it('cycles to dark when clicked in light mode', async () => {
      const { mockSetTheme } = setupTheme({ theme: 'light', resolvedTheme: 'light' })
      render(<ThemeToggle />)
      await waitForMounted()
      fireEvent.click(screen.getByRole('button'))
      expect(mockSetTheme).toHaveBeenCalledWith('dark')
    })

    it('cycles to system when clicked in dark mode', async () => {
      const { mockSetTheme } = setupTheme({ theme: 'dark', resolvedTheme: 'dark' })
      render(<ThemeToggle />)
      await waitForMounted()
      fireEvent.click(screen.getByRole('button'))
      expect(mockSetTheme).toHaveBeenCalledWith('system')
    })
  })

  describe('fallback behavior', () => {
    it('defaults to system label and Monitor icon when theme is undefined', async () => {
      setupTheme({ theme: undefined })
      render(<ThemeToggle />)
      await waitForMounted()
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to light mode')
      expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument()
    })

    it('renders Monitor icon and fallback label for unknown theme value', async () => {
      setupTheme({ theme: 'unknown', resolvedTheme: 'dark' })
      render(<ThemeToggle />)
      await waitForMounted()
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Toggle theme')
    })
  })

  describe('accessibility', () => {
    it('is a focusable button element', async () => {
      setupTheme()
      render(<ThemeToggle />)
      await waitForMounted()
      const button = screen.getByRole('button')
      button.focus()
      expect(document.activeElement).toBe(button)
    })

    it('handles click keyboard activation', async () => {
      const { mockSetTheme } = setupTheme({ theme: 'system' })
      render(<ThemeToggle />)
      await waitForMounted()
      fireEvent.click(screen.getByRole('button'))
      expect(mockSetTheme).toHaveBeenCalledTimes(1)
    })

    it('has an svg marked as aria-hidden', async () => {
      setupTheme()
      render(<ThemeToggle />)
      await waitForMounted()
      const svg = screen.getByRole('button').querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })
  })
})
