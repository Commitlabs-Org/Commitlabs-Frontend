// @vitest-environment happy-dom

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RequireWallet from '@/components/auth/RequireWallet'
import { WalletProvider } from '@/components/auth/WalletProvider'

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
}))

describe('RequireWallet', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete window.freighterApi
  })

  afterEach(() => {
    cleanup()
    document.body.style.overflow = ''
  })

  it('renders protected content immediately when the wallet is already connected', () => {
    window.localStorage.setItem('commitlabs.wallet.address', 'GCONNECTED123')

    render(
      <WalletProvider>
        <RequireWallet>
          <div>Protected content</div>
        </RequireWallet>
      </WalletProvider>
    )

    return waitFor(() => {
      expect(screen.getByText('Protected content')).toBeTruthy()
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('renders a connect prompt instead of the protected page when disconnected', async () => {
    render(
      <WalletProvider>
        <RequireWallet>
          <div>Protected content</div>
        </RequireWallet>
      </WalletProvider>
    )

    expect(screen.queryByText('Protected content')).toBeNull()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Connect your wallet to continue' })).toBeTruthy()
    expect(screen.getByText('Requested route')).toBeTruthy()

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Connect Wallet' }))
    })
  })

  it('reveals the protected content after a successful connect action', async () => {
    window.freighterApi = {
      requestAccess: vi.fn().mockResolvedValue({ address: 'GSUCCESS123' }),
    }

    render(
      <WalletProvider>
        <RequireWallet>
          <div>Protected content</div>
        </RequireWallet>
      </WalletProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Connect Wallet' }))

    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeTruthy()
    })
  })
})
