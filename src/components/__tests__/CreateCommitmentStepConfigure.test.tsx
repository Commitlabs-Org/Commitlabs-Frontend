/**
 * @vitest-environment happy-dom
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import CreateCommitmentStepConfigure from '../CreateCommitmentStepConfigure'

// ─── Default valid props ──────────────────────────────────────────────────────

const defaultProps = {
  amount: '100',
  asset: 'XLM',
  availableBalance: 10000,
  durationDays: 90,
  maxLossPercent: 50,
  earlyExitPenalty: '3 XLM',
  estimatedFees: '0.00 XLM',
  isValid: true,
  ownerAddress: 'GABC1234',
  onChangeAmount: vi.fn(),
  onChangeAsset: vi.fn(),
  onChangeDuration: vi.fn(),
  onChangeMaxLoss: vi.fn(),
  onBack: vi.fn(),
  onNext: vi.fn(),
}

function validResponse() {
  return {
    ok: true,
    json: async () => ({ success: true, data: { valid: true, errors: [], warnings: [] } }),
  }
}

function errorResponse(errors: { field: string; message: string }[]) {
  return {
    ok: true,
    json: async () => ({ success: true, data: { valid: false, errors, warnings: [] } }),
  }
}

// Advance fake timers past debounce and flush all pending microtasks/promises
async function advancePastDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(500)
    await vi.runAllTimersAsync()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn())
  defaultProps.onNext.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreateCommitmentStepConfigure – server validation', () => {
  it('renders without crashing and shows the Continue button', () => {
    vi.mocked(fetch).mockResolvedValue(validResponse() as Response)
    render(<CreateCommitmentStepConfigure {...defaultProps} />)
    expect(
      screen.getByRole('button', { name: /continue|validating/i })
    ).toBeInTheDocument()
  })

  it('button is disabled while server validation is in-flight', async () => {
    vi.mocked(fetch).mockImplementation(
      () => new Promise(() => {/* never resolves */})
    )
    render(<CreateCommitmentStepConfigure {...defaultProps} />)

    await act(async () => { vi.advanceTimersByTime(500) })

    const btn = screen.getByRole('button', { name: /validating/i })
    expect(btn).toBeDisabled()
  })

  it('button is enabled after a valid server response', async () => {
    vi.mocked(fetch).mockResolvedValue(validResponse() as Response)
    render(<CreateCommitmentStepConfigure {...defaultProps} />)

    await advancePastDebounce()

    const btn = screen.getByRole('button', { name: /continue/i })
    expect(btn).not.toBeDisabled()
  })

  it('maps a single field error to the correct input', async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse([{ field: 'amount', message: 'Amount too low' }]) as Response
    )
    render(<CreateCommitmentStepConfigure {...defaultProps} />)

    await advancePastDebounce()

    expect(screen.getByRole('alert')).toHaveTextContent('Amount too low')
  })

  it('maps multiple field errors simultaneously', async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse([
        { field: 'amount', message: 'Amount too low' },
        { field: 'durationDays', message: 'Duration too short' },
      ]) as Response
    )
    render(<CreateCommitmentStepConfigure {...defaultProps} />)

    await advancePastDebounce()

    const alerts = screen.getAllByRole('alert')
    expect(alerts.some((a) => a.textContent?.includes('Amount too low'))).toBe(true)
    expect(alerts.some((a) => a.textContent?.includes('Duration too short'))).toBe(true)
  })

  it('blocks onNext while server errors are present', async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse([{ field: 'amount', message: 'Amount too low' }]) as Response
    )
    render(<CreateCommitmentStepConfigure {...defaultProps} />)

    await advancePastDebounce()
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(defaultProps.onNext).not.toHaveBeenCalled()
  })

  it('calls onNext after errors are cleared', async () => {
    vi.mocked(fetch).mockResolvedValue(validResponse() as Response)
    render(<CreateCommitmentStepConfigure {...defaultProps} />)

    await advancePastDebounce()

    const btn = screen.getByRole('button', { name: /continue/i })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1)
  })

  it('debounces – does not call fetch before 500ms', async () => {
    vi.mocked(fetch).mockResolvedValue(validResponse() as Response)
    render(<CreateCommitmentStepConfigure {...defaultProps} />)

    await act(async () => { vi.advanceTimersByTime(400) })
    expect(fetch).not.toHaveBeenCalled()

    await advancePastDebounce()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('cancels previous request on rapid field changes', async () => {
    vi.mocked(fetch).mockResolvedValue(validResponse() as Response)
    const { rerender } = render(<CreateCommitmentStepConfigure {...defaultProps} />)

    await act(async () => { vi.advanceTimersByTime(300) })
    rerender(<CreateCommitmentStepConfigure {...defaultProps} amount="200" />)
    await advancePastDebounce()

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('clears server errors and does not block on network failure (graceful fallback)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    render(<CreateCommitmentStepConfigure {...defaultProps} />)

    await advancePastDebounce()

    const btn = screen.getByRole('button', { name: /continue/i })
    expect(btn).not.toBeDisabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('marks amount input as aria-invalid when server returns an amount error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse([{ field: 'amount', message: 'Amount too low' }]) as Response
    )
    render(<CreateCommitmentStepConfigure {...defaultProps} />)

    await advancePastDebounce()

    const amountInput = screen.getByRole('spinbutton', { name: /commitment amount/i })
    expect(amountInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('button is disabled when isValid=false regardless of server response', async () => {
    vi.mocked(fetch).mockResolvedValue(validResponse() as Response)
    render(<CreateCommitmentStepConfigure {...defaultProps} isValid={false} />)

    await advancePastDebounce()

    // After validation completes, button should still be disabled due to isValid=false
    const btn = screen.getByRole('button', { name: /continue/i })
    expect(btn).toBeDisabled()
  })

  it('sends maxLossBps (percent * 100) in the request body', async () => {
    vi.mocked(fetch).mockResolvedValue(validResponse() as Response)
    render(<CreateCommitmentStepConfigure {...defaultProps} maxLossPercent={30} />)

    await advancePastDebounce()

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
    expect(body.maxLossBps).toBe(3000)
  })
})
