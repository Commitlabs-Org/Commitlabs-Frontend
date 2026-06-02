// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TransactionError from '@/app/transaction-error/page'

const routerBack = vi.fn()
let params = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: routerBack,
  }),
  useSearchParams: () => params,
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
  }) => (
    React.createElement('a', { href, className }, children)
  ),
}))

describe('transaction error page recovery actions', () => {
  beforeEach(() => {
    params = new URLSearchParams()
    routerBack.mockClear()
  })

  it('renders rejected transaction recovery from normalized validation errors', () => {
    params = new URLSearchParams({
      code: 'VALIDATION_ERROR',
      message: 'The transaction was rejected due to invalid parameters or state.',
    })

    render(React.createElement(TransactionError))

    const heading = screen.getByRole('heading', { level: 1, name: 'Transaction Rejected' })
    expect(heading).toHaveFocus()
    expect(screen.getByRole('heading', { level: 2, name: 'No transaction was completed' })).toBeInTheDocument()
    expect(screen.getByText('Confirm the wallet signature prompt was approved.')).toBeInTheDocument()
    expect(screen.getByText('VALIDATION_ERROR')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/commitments/overview')

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(routerBack).toHaveBeenCalledTimes(1)
  })

  it('renders timeout recovery with an explorer check before retry guidance', () => {
    params = new URLSearchParams({
      code: 'GATEWAY_TIMEOUT',
      hash: 'abc 123',
    })

    render(React.createElement(TransactionError))

    expect(screen.getByRole('heading', { level: 1, name: 'Transaction Status Unknown' })).toHaveFocus()
    expect(screen.getByRole('heading', { level: 2, name: 'Check before resubmitting' })).toBeInTheDocument()
    expect(screen.getByText('Avoid submitting the same signed transaction twice.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Check Explorer' })).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/public/tx/abc%20123',
    )
  })

  it('renders failed transaction recovery for normalized chain call failures', () => {
    params = new URLSearchParams({
      code: 'BLOCKCHAIN_CALL_FAILED',
      hash: 'deadbeef',
    })

    render(React.createElement(TransactionError))

    expect(screen.getByRole('heading', { level: 1, name: 'Transaction Failed' })).toHaveFocus()
    expect(screen.getByRole('heading', { level: 2, name: 'The action did not finish' })).toBeInTheDocument()
    expect(screen.getByText('Check whether the smart contract rejected the operation.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View on Explorer' })).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/public/tx/deadbeef',
    )
  })
})
