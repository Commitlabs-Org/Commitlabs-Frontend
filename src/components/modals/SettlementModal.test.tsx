// @vitest-environment happy-dom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SettlementModal, {
  getSettlementIneligibleReasonCopy,
} from '@/components/modals/SettlementModal';

// ── Shared default props ─────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  commitmentId: 'CMT-SETTLE-001',
  state: 'eligible' as const,
  onReturnToDashboard: vi.fn(),
  onClose: vi.fn(),
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderModal(props: Record<string, unknown> = {}) {
  return render(<SettlementModal {...defaultProps} {...props} />);
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

// ── Suite ────────────────────────────────────────────────────────────────────

describe('SettlementModal', () => {
  // ── 1. Open / closed rendering ────────────────────────────────────────────

  it('renders the dialog when isOpen is true', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // ── 2. Eligible state ────────────────────────────────────────────────────

  describe('eligible state', () => {
    it('shows "Ready to settle" heading and settlement amount', () => {
      renderModal({ state: 'eligible', settlementAmount: '150.00 XLM' });
      expect(screen.getByRole('heading', { name: 'Ready to settle' })).toBeTruthy();
      expect(screen.getByText('150.00 XLM')).toBeTruthy();
    });

    it('shows "Pending preview" when no settlementAmount provided', () => {
      renderModal({ state: 'eligible' });
      expect(screen.getByText('Pending preview')).toBeTruthy();
    });

    it('renders Confirm settlement button', () => {
      renderModal({ state: 'eligible', onConfirmSettlement: vi.fn() });
      expect(screen.getByRole('button', { name: 'Confirm settlement' })).toBeTruthy();
    });

    it('calls onConfirmSettlement when Confirm is clicked', () => {
      const onConfirmSettlement = vi.fn();
      renderModal({ state: 'eligible', onConfirmSettlement });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm settlement' }));
      expect(onConfirmSettlement).toHaveBeenCalledTimes(1);
    });

    it('disables Confirm when isSettlementActionDisabled is true', () => {
      renderModal({
        state: 'eligible',
        onConfirmSettlement: vi.fn(),
        isSettlementActionDisabled: true,
      });
      expect(screen.getByRole('button', { name: 'Confirm settlement' })).toBeDisabled();
    });

    it('calls onReturnToDashboard when Return button is clicked', () => {
      const onReturnToDashboard = vi.fn();
      renderModal({ state: 'eligible', onReturnToDashboard });
      fireEvent.click(screen.getByRole('button', { name: 'Return to dashboard' }));
      expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
    });
  });

  // ── 3. Processing state ──────────────────────────────────────────────────

  describe('processing state', () => {
    it('shows "Settlement in progress" heading', () => {
      renderModal({ state: 'processing', processingStep: 'confirming' });
      expect(screen.getByRole('heading', { name: 'Settlement in progress' })).toBeTruthy();
    });

    it('renders all 3 progress steps', () => {
      renderModal({ state: 'processing', processingStep: 'initiating' });
      expect(screen.getByText('Initiating')).toBeTruthy();
      expect(screen.getByText('Confirming on Stellar')).toBeTruthy();
      expect(screen.getByText('Finalizing')).toBeTruthy();
    });

    it('highlights the active step', () => {
      renderModal({ state: 'processing', processingStep: 'confirming' });
      const steps = screen.getAllByRole('listitem');
      expect(steps[1].className).toContain('border-[#0FF0FC]/30');
    });

    it('marks prior steps as complete', () => {
      renderModal({ state: 'processing', processingStep: 'finalizing' });
      const steps = screen.getAllByRole('listitem');
      expect(steps[0].textContent).toContain('OK');
      expect(steps[1].textContent).toContain('OK');
    });

    it('defaults to "initiating" when processingStep is omitted', () => {
      renderModal({ state: 'processing' });
      const steps = screen.getAllByRole('listitem');
      expect(steps[0].className).toContain('border-[#0FF0FC]/30');
    });
  });

  // ── 4. Error state ───────────────────────────────────────────────────────

  describe('error state', () => {
    it('shows error heading and default message', () => {
      renderModal({ state: 'error' });
      expect(
        screen.getByRole('heading', { name: 'Settlement could not be completed' }),
      ).toBeTruthy();
      expect(
        screen.getByText(/The settlement flow stopped before reaching a final state/),
      ).toBeTruthy();
    });

    it('shows custom errorMessage when provided', () => {
      renderModal({ state: 'error', errorMessage: 'Horizon timeout' });
      expect(screen.getByText('Horizon timeout')).toBeTruthy();
    });

    it('renders Retry settlement button', () => {
      renderModal({ state: 'error', onRetrySettlement: vi.fn() });
      expect(screen.getByRole('button', { name: 'Retry settlement' })).toBeTruthy();
    });

    it('calls onRetrySettlement when Retry is clicked', () => {
      const onRetrySettlement = vi.fn();
      renderModal({ state: 'error', onRetrySettlement });
      fireEvent.click(screen.getByRole('button', { name: 'Retry settlement' }));
      expect(onRetrySettlement).toHaveBeenCalledTimes(1);
    });

    it('disables Retry when isSettlementActionDisabled is true', () => {
      renderModal({
        state: 'error',
        onRetrySettlement: vi.fn(),
        isSettlementActionDisabled: true,
      });
      expect(screen.getByRole('button', { name: 'Retry settlement' })).toBeDisabled();
    });
  });

  // ── 5. Ineligible state ──────────────────────────────────────────────────

  describe('ineligible state', () => {
    it('shows "Settlement unavailable" heading', () => {
      renderModal({ state: 'ineligible', ineligibleReason: 'not matured yet' });
      expect(screen.getByRole('heading', { name: 'Settlement unavailable' })).toBeTruthy();
    });

    it('renders the ineligible reason alert', () => {
      renderModal({ state: 'ineligible', ineligibleReason: 'not matured yet' });
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    it('shows the raw reason text when ineligibleReason is provided', () => {
      renderModal({ state: 'ineligible', ineligibleReason: 'Not matured yet' });
      expect(screen.getByText('Not matured yet')).toBeTruthy();
    });

    it('does not show the raw reason text when ineligibleReason is absent', () => {
      renderModal({ state: 'ineligible' });
      expect(screen.queryByText(/Reason from settlement check/)).toBeNull();
    });

    it('calls onReturnToDashboard', () => {
      const onReturnToDashboard = vi.fn();
      renderModal({ state: 'ineligible', onReturnToDashboard });
      fireEvent.click(screen.getByRole('button', { name: 'Return to dashboard' }));
      expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
    });
  });

  // ── 6. Settled state ─────────────────────────────────────────────────────

  describe('settled state', () => {
    it('shows "Settlement complete" heading', () => {
      renderModal({ state: 'settled' });
      expect(screen.getByRole('heading', { name: 'Settlement complete' })).toBeTruthy();
    });

    it('shows settlement amount when provided', () => {
      renderModal({ state: 'settled', settlementAmount: '200.00 XLM' });
      expect(screen.getByText('200.00 XLM')).toBeTruthy();
    });

    it('hides settlement amount when not provided', () => {
      renderModal({ state: 'settled' });
      expect(screen.queryByText(/Settlement amount/)).toBeNull();
    });

    it('calls onReturnToDashboard', () => {
      const onReturnToDashboard = vi.fn();
      renderModal({ state: 'settled', onReturnToDashboard });
      fireEvent.click(screen.getByRole('button', { name: 'Return to dashboard' }));
      expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
    });
  });

  // ── 7. Close button ──────────────────────────────────────────────────────

  it('renders close button when onClose is provided', () => {
    renderModal({ onClose: vi.fn() });
    expect(screen.getByRole('button', { name: 'Close settlement modal' })).toBeTruthy();
  });

  it('hides close button when onClose is not provided', () => {
    renderModal({ onClose: undefined });
    expect(screen.queryByRole('button', { name: 'Close settlement modal' })).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close settlement modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── 8. Escape closes modal ───────────────────────────────────────────────

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── 9. Commitment details link ───────────────────────────────────────────

  it('links to the commitment details page', () => {
    renderModal({ state: 'ineligible', ineligibleReason: 'unknown thing' });
    const link = screen.getByRole('link', { name: /Review commitment details/ });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/commitments/CMT-SETTLE-001');
  });
});

// ── getSettlementIneligibleReasonCopy (pure function) ────────────────────────

describe('getSettlementIneligibleReasonCopy', () => {
  it('returns "not_matured" category for "not matured"', () => {
    const result = getSettlementIneligibleReasonCopy('not matured yet');
    expect(result.category).toBe('not_matured');
    expect(result.tone).toBe('temporary');
  });

  it('returns "already_settled" category', () => {
    const result = getSettlementIneligibleReasonCopy('already been settled');
    expect(result.category).toBe('already_settled');
    expect(result.tone).toBe('terminal');
  });

  it('returns "disputed" category for "violated"', () => {
    const result = getSettlementIneligibleReasonCopy('commitment violated');
    expect(result.category).toBe('disputed');
    expect(result.tone).toBe('terminal');
  });

  it('returns "disputed" category for "disputed"', () => {
    const result = getSettlementIneligibleReasonCopy('disputed');
    expect(result.category).toBe('disputed');
  });

  it('returns "disputed" category for "cannot be settled"', () => {
    const result = getSettlementIneligibleReasonCopy('cannot be settled');
    expect(result.category).toBe('disputed');
  });

  it('returns "early_exit" category', () => {
    const result = getSettlementIneligibleReasonCopy('early exit requested');
    expect(result.category).toBe('early_exit');
    expect(result.tone).toBe('terminal');
  });

  it('returns "unknown" category for unrecognized reason', () => {
    const result = getSettlementIneligibleReasonCopy('something weird');
    expect(result.category).toBe('unknown');
    expect(result.tone).toBe('unknown');
  });

  it('returns "unknown" category when reason is undefined', () => {
    const result = getSettlementIneligibleReasonCopy(undefined);
    expect(result.category).toBe('unknown');
  });

  it('is case-insensitive', () => {
    const result = getSettlementIneligibleReasonCopy('ALREADY SETTLED');
    expect(result.category).toBe('already_settled');
  });
});
