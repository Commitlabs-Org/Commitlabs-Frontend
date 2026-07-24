/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ActiveSessionsSection, ActiveSession } from './ActiveSessionsSection'

const currentSession: ActiveSession = {
  id: 'session_current',
  userAgent: 'Mozilla/5.0 (Macintosh)',
  ipAddress: '127.0.0.1',
  createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  isCurrent: true,
}

const otherSession: ActiveSession = {
  id: 'session_other',
  userAgent: 'Mozilla/5.0 (Windows)',
  ipAddress: '192.168.1.2',
  createdAt: new Date('2024-01-01T08:00:00Z').toISOString(),
  isCurrent: false,
}

describe('ActiveSessionsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the section title and description', () => {
    render(<ActiveSessionsSection sessions={[currentSession]} />)
    expect(screen.getByText('Active Sessions')).toBeInTheDocument()
    expect(
      screen.getByText(/View all devices signed into your account/i),
    ).toBeInTheDocument()
  })

  it('shows empty state when no sessions provided', () => {
    render(<ActiveSessionsSection sessions={[]} />)
    expect(screen.getByText('No session data available.')).toBeInTheDocument()
  })

  it('highlights the current session with a "Current" badge', () => {
    render(<ActiveSessionsSection sessions={[currentSession, otherSession]} />)
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('does not show "Current" badge on other sessions', () => {
    render(<ActiveSessionsSection sessions={[otherSession]} />)
    expect(screen.queryByText('Current')).not.toBeInTheDocument()
  })

  it('does not render revoke button when there are no other sessions', () => {
    render(<ActiveSessionsSection sessions={[currentSession]} />)
    expect(
      screen.queryByRole('button', { name: /revoke other sessions/i }),
    ).not.toBeInTheDocument()
  })

  it('renders revoke button when there are other sessions', () => {
    render(<ActiveSessionsSection sessions={[currentSession, otherSession]} />)
    expect(
      screen.getByRole('button', { name: /revoke other sessions/i }),
    ).toBeInTheDocument()
  })

  it('shows confirmation dialog when revoke button is clicked', () => {
    render(<ActiveSessionsSection sessions={[currentSession, otherSession]} />)
    fireEvent.click(screen.getByRole('button', { name: /revoke other sessions/i }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/revoke 1 other session\?/i)).toBeInTheDocument()
  })

  it('cancels revocation on Cancel click', () => {
    render(<ActiveSessionsSection sessions={[currentSession, otherSession]} />)
    fireEvent.click(screen.getByRole('button', { name: /revoke other sessions/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /revoke other sessions/i }),
    ).toBeInTheDocument()
  })

  it('calls onRevokeOthers and shows success status on confirm', async () => {
    const onRevokeOthers = vi.fn().mockResolvedValue(undefined)
    render(
      <ActiveSessionsSection
        sessions={[currentSession, otherSession]}
        onRevokeOthers={onRevokeOthers}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /revoke other sessions/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, revoke/i }))
    await waitFor(() => {
      expect(onRevokeOthers).toHaveBeenCalledOnce()
    })
    await waitFor(() => {
      expect(
        screen.getByText('All other sessions have been revoked.'),
      ).toBeInTheDocument()
    })
  })

  it('shows error message when revocation fails', async () => {
    const onRevokeOthers = vi
      .fn()
      .mockRejectedValue(new Error('Network error'))
    render(
      <ActiveSessionsSection
        sessions={[currentSession, otherSession]}
        onRevokeOthers={onRevokeOthers}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /revoke other sessions/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, revoke/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('announces status via live region', async () => {
    const onRevokeOthers = vi.fn().mockResolvedValue(undefined)
    render(
      <ActiveSessionsSection
        sessions={[currentSession, otherSession]}
        onRevokeOthers={onRevokeOthers}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /revoke other sessions/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, revoke/i }))
    await waitFor(() => {
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveTextContent('All other sessions have been revoked.')
    })
  })

  it('shows correct plural label for multiple other sessions', () => {
    const anotherSession: ActiveSession = {
      id: 'session_another',
      userAgent: 'curl/7.0',
      ipAddress: '10.0.0.1',
      createdAt: new Date('2024-01-01T09:00:00Z').toISOString(),
      isCurrent: false,
    }
    render(
      <ActiveSessionsSection
        sessions={[currentSession, otherSession, anotherSession]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /revoke other sessions/i }))
    expect(screen.getByText(/revoke 2 other sessions\?/i)).toBeInTheDocument()
  })

  it('falls back to fetch when no onRevokeOthers prop is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    render(<ActiveSessionsSection sessions={[currentSession, otherSession]} />)
    fireEvent.click(screen.getByRole('button', { name: /revoke other sessions/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, revoke/i }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/sessions/revoke-others',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})
