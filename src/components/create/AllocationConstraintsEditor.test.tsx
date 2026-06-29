/**
 * @vitest-environment happy-dom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AllocationConstraintsEditor from './AllocationConstraintsEditor'

const mockProtocolConstants = {
  protocolVersion: '1.0.0',
  network: 'testnet',
  fees: { networkBaseFeeStroops: 100, platformFeePercent: 0 },
  penalties: [],
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
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockProtocolConstants),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AllocationConstraintsEditor', () => {
  const defaultProps = {
    maxLossPercent: 50,
    commitmentType: 'balanced' as const,
    amount: '1000',
    asset: 'XLM',
    onChangeMaxLoss: vi.fn(),
  }

  it('renders the headroom gauge with correct aria values', () => {
    render(<AllocationConstraintsEditor {...defaultProps} />)
    const gauge = screen.getByRole('progressbar')
    expect(gauge).toHaveAttribute('aria-valuemin', '0')
    expect(gauge).toHaveAttribute('aria-valuemax', '100')
    expect(gauge).toHaveAttribute('aria-valuenow', '50')
  })

  it('renders constraint items based on current settings', () => {
    render(<AllocationConstraintsEditor {...defaultProps} />)
    expect(screen.getByText(/Maximum acceptable loss: 50%/)).toBeInTheDocument()
    expect(screen.getByText(/Commitment type: Balanced/)).toBeInTheDocument()
    expect(screen.getByText(/Protocol ceiling: 100%/)).toBeInTheDocument()
  })

  it('shows the computed absolute loss value in the constraint item', () => {
    render(<AllocationConstraintsEditor {...defaultProps} />)
    expect(screen.getByText(/500\.00 XLM/)).toBeInTheDocument()
  })

  it('calls onChangeMaxLoss when the slider changes', () => {
    render(<AllocationConstraintsEditor {...defaultProps} />)
    const slider = screen.getByLabelText('Max loss percentage slider')
    fireEvent.change(slider, { target: { value: '75' } })
    expect(defaultProps.onChangeMaxLoss).toHaveBeenCalledWith(75)
  })

  it('calls onChangeMaxLoss when the number input changes', () => {
    render(<AllocationConstraintsEditor {...defaultProps} />)
    const input = screen.getByLabelText('Max loss percentage input')
    fireEvent.change(input, { target: { value: '80' } })
    expect(defaultProps.onChangeMaxLoss).toHaveBeenCalledWith(80)
  })

  it('clamps max loss to protocol ceiling via number input', () => {
    render(<AllocationConstraintsEditor {...defaultProps} />)
    const input = screen.getByLabelText('Max loss percentage input')
    fireEvent.change(input, { target: { value: '150' } })
    expect(defaultProps.onChangeMaxLoss).toHaveBeenCalledWith(100)
  })

  it('clamps max loss to zero floor via number input', () => {
    render(<AllocationConstraintsEditor {...defaultProps} />)
    const input = screen.getByLabelText('Max loss percentage input')
    fireEvent.change(input, { target: { value: '-5' } })
    expect(defaultProps.onChangeMaxLoss).toHaveBeenCalledWith(0)
  })

  it('shows risk description that updates with max loss value', () => {
    const { rerender } = render(<AllocationConstraintsEditor {...defaultProps} />)
    expect(screen.getByText(/Moderate risk: balanced exposure/)).toBeInTheDocument()

    rerender(<AllocationConstraintsEditor {...defaultProps} maxLossPercent={85} />)
    expect(screen.getByText(/Aggressive: maximum risk exposure/)).toBeInTheDocument()

    rerender(<AllocationConstraintsEditor {...defaultProps} maxLossPercent={5} />)
    expect(screen.getByText(/Conservative: minimal risk exposure/)).toBeInTheDocument()
  })

  it('renders on-chain enforcement note', () => {
    render(<AllocationConstraintsEditor {...defaultProps} />)
    expect(screen.getByText(/On-chain enforcement/)).toBeInTheDocument()
  })

  it('has accessible labelled controls', () => {
    render(<AllocationConstraintsEditor {...defaultProps} />)
    expect(screen.getByLabelText('Max loss percentage slider')).toBeInTheDocument()
    expect(screen.getByLabelText('Max loss percentage input')).toBeInTheDocument()
    expect(screen.getByLabelText('Max loss headroom gauge')).toBeInTheDocument()
  })

  it('renders commitment type constraint for each type', () => {
    const { rerender } = render(<AllocationConstraintsEditor {...defaultProps} />)
    expect(screen.getByText(/Commitment type: Balanced/)).toBeInTheDocument()

    rerender(<AllocationConstraintsEditor {...defaultProps} commitmentType="safe" />)
    expect(screen.getByText(/Commitment type: Safe/)).toBeInTheDocument()

    rerender(<AllocationConstraintsEditor {...defaultProps} commitmentType="aggressive" />)
    expect(screen.getByText(/Commitment type: Aggressive/)).toBeInTheDocument()
  })

  it('applies green gauge color for low max loss', () => {
    render(<AllocationConstraintsEditor {...defaultProps} maxLossPercent={15} />)
    const threshold = screen.getByText('15%')
    expect(threshold).toHaveStyle({ color: '#00d4aa' })
  })

  it('applies warning gauge color for medium max loss', () => {
    render(<AllocationConstraintsEditor {...defaultProps} maxLossPercent={50} />)
    const threshold = screen.getByText('50%')
    expect(threshold).toHaveStyle({ color: '#f5a623' })
  })

  it('applies danger gauge color for high max loss', () => {
    render(<AllocationConstraintsEditor {...defaultProps} maxLossPercent={85} />)
    const threshold = screen.getByText('85%')
    expect(threshold).toHaveStyle({ color: '#ff4444' })
  })

  it('uses protocol ceiling from fetched constants', async () => {
    const customConstants = {
      ...mockProtocolConstants,
      commitmentLimits: { ...mockProtocolConstants.commitmentLimits, maxLossPercentCeiling: 80 },
    }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(customConstants),
    })
    render(<AllocationConstraintsEditor {...defaultProps} maxLossPercent={60} />)

    const gauge = await screen.findByRole('progressbar')
    expect(gauge).toHaveAttribute('aria-valuemax', '80')
    expect(screen.getByText(/Ceiling: 80%/)).toBeInTheDocument()
  })
})
