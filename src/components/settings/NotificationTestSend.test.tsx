import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationToggle } from './NotificationToggle'
import { ToastProvider } from '@/components/toast/ToastProvider'

// Mock fetch for the API call
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('NotificationTestSend in NotificationToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
  })

  const renderWithToast = (ui: React.ReactElement) => {
    return render(
      <ToastProvider>
        {ui}
      </ToastProvider>
    )
  }

  it('renders the Send test button when integrated', () => {
    renderWithToast(
      <NotificationToggle
        id="test-channel"
        label="Test Channel"
        description="A test channel"
        enabled={true}
        onChange={vi.fn()}
      />
    )
    
    expect(screen.getByRole('button', { name: /Send test notification for Test Channel/i })).toBeInTheDocument()
  })

  it('disables the Send test button when toggle is disabled', () => {
    renderWithToast(
      <NotificationToggle
        id="test-channel"
        label="Test Channel"
        description="A test channel"
        enabled={false}
        onChange={vi.fn()}
      />
    )
    
    const sendBtn = screen.getByRole('button', { name: /Send test notification for Test Channel/i })
    expect(sendBtn).toBeDisabled()
  })

  it('triggers a test send and shows sending state', async () => {
    mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ ok: true, status: 200 }), 100)))

    renderWithToast(
      <NotificationToggle
        id="test-channel"
        label="Test Channel"
        description="A test channel"
        enabled={true}
        onChange={vi.fn()}
      />
    )

    const sendBtn = screen.getByRole('button', { name: /Send test notification for Test Channel/i })
    fireEvent.click(sendBtn)

    expect(sendBtn).toBeDisabled()
    expect(screen.getByText('Sending...')).toBeInTheDocument()

    await waitFor(() => {
      expect(sendBtn).not.toBeDisabled()
      expect(screen.getByText('Send test')).toBeInTheDocument()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/notifications/test', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ channel: 'test-channel' })
    }))
  })

  it('handles test send failures gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    renderWithToast(
      <NotificationToggle
        id="error-channel"
        label="Error Channel"
        description="A channel that fails"
        enabled={true}
        onChange={vi.fn()}
      />
    )

    const sendBtn = screen.getByRole('button', { name: /Send test notification for Error Channel/i })
    fireEvent.click(sendBtn)

    expect(sendBtn).toBeDisabled()

    await waitFor(() => {
      expect(sendBtn).not.toBeDisabled()
    })

    expect(mockFetch).toHaveBeenCalled()
  })
})
