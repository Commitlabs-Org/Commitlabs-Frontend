/**
 * @vitest-environment happy-dom
 */

import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import CostYieldEstimator from './CostYieldEstimator'

const mockConstants = {
  protocolVersion: '1.0.0',
  network: 'testnet',
  fees: { networkBaseFeeStroops: 100, platformFeePercent: 1 },
  penalties: [
    { type: 'early_exit', earlyExitPenaltyPercent: 5, description: 'Early exit' },
    { type: 'aggressive', earlyExitPenaltyPercent: 15, description: 'Aggressive early exit' },
  ],
  commitmentLimits: {
    minAmountXlm: 10,
    maxAmountXlm: 1_000_000,
    minDurationDays: 1,
    maxDurationDays: 365,
    maxLossPercentCeiling: 100,
  },
  cachedAt: new Date().toISOString(),
}

beforeEach(() => {
  vi.useFakeTimers()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockConstants),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const defaultProps = {
  amount: '1000',
  durationDays: 30,
  maxLossPercent: 10,
  asset: 'XLM',
}

describe('CostYieldEstimator', () => {
  it('renders the estimator section with accessible label', () => {
    render(<CostYieldEstimator {...defaultProps} />)
    expect(screen.getByRole('region', { name: /cost and yield estimator/i })).toBeInTheDocument()
  })

  it('shows placeholder when constants are not yet loaded', () => {
    render(<CostYieldEstimator {...defaultProps} />)
    expect(screen.getByTestId('estimator-placeholder')).toBeInTheDocument()
  })

  it('shows placeholder for invalid amount (empty string)', async () => {
    render(<CostYieldEstimator {...defaultProps} amount="" />)
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
    })
    expect(screen.getByTestId('estimator-placeholder')).toBeInTheDocument()
  })

  it('shows placeholder for zero amount', async () => {
    render(<CostYieldEstimator {...defaultProps} amount="0" />)
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
    })
    expect(screen.getByTestId('estimator-placeholder')).toBeInTheDocument()
  })

  it('shows placeholder for durationDays less than 1', async () => {
    render(<CostYieldEstimator {...defaultProps} durationDays={0} />)
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
    })
    expect(screen.getByTestId('estimator-placeholder')).toBeInTheDocument()
  })

  it('shows estimated values after constants load and debounce', async () => {
    render(<CostYieldEstimator {...defaultProps} />)
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
    })
    expect(screen.getByTestId('projected-yield')).toBeInTheDocument()
    expect(screen.getByTestId('worst-case-penalty')).toBeInTheDocument()
    expect(screen.getByTestId('platform-fee')).toBeInTheDocument()
  })

  it('updates estimates when inputs change', async () => {
    const { rerender } = render(<CostYieldEstimator {...defaultProps} />)
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
    })
    const yieldBefore = screen.getByTestId('projected-yield').textContent

    rerender(<CostYieldEstimator {...defaultProps} amount="5000" />)
    await act(async () => {
      vi.runAllTimers()
    })
    const yieldAfter = screen.getByTestId('projected-yield').textContent
    expect(yieldAfter).not.toBe(yieldBefore)
  })

  it('uses worst-case penalty from protocol constants, not hardcoded', async () => {
    render(<CostYieldEstimator {...defaultProps} amount="1000" maxLossPercent={5} />)
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
    })
    // Worst case = max penalty tier (15%) × 1000 = 150.00
    const penalty = screen.getByTestId('worst-case-penalty')
    expect(penalty.textContent).toContain('150.00')
  })

  it('computes platform fee from protocol constants platformFeePercent', async () => {
    render(<CostYieldEstimator {...defaultProps} amount="1000" />)
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
    })
    // platformFeePercent=1 => fee = 1% of 1000 = 10.00
    const fee = screen.getByTestId('platform-fee')
    expect(fee.textContent).toContain('10.00')
  })

  it('shows the asset label in all estimate rows', async () => {
    render(<CostYieldEstimator {...defaultProps} asset="USDC" />)
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
    })
    const rows = screen.getAllByText(/USDC/)
    expect(rows.length).toBeGreaterThanOrEqual(3)
  })

  it('labels all figures as estimates', () => {
    render(<CostYieldEstimator {...defaultProps} />)
    expect(screen.getByText(/estimates only/i)).toBeInTheDocument()
  })

  it('has aria-live polite for screen reader updates', () => {
    render(<CostYieldEstimator {...defaultProps} />)
    const section = screen.getByTestId('cost-yield-estimator')
    expect(section).toHaveAttribute('aria-live', 'polite')
  })

  it('handles fetch failure gracefully and keeps placeholder', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    render(<CostYieldEstimator {...defaultProps} />)
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
    })
    expect(screen.getByTestId('estimator-placeholder')).toBeInTheDocument()
  })
})
