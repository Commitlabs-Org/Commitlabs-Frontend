// @vitest-environment happy-dom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SettlementModal, {
  getSettlementIneligibleReasonCopy,
} from '@/components/modals/SettlementModal';

const baseProps = {
  isOpen: true,
  commitmentId: 'CMT-123',
  state: 'ineligible' as const,
  onReturnToDashboard: vi.fn(),
};

function renderSettlementModal(props: Partial<React.ComponentProps<typeof SettlementModal>> = {}) {
  return render(React.createElement(SettlementModal, { ...baseProps, ...props }));
}

describe('SettlementModal ineligible reasons', () => {
  it.each([
    ['  commitment has NOT MATURED yet  ', 'not_matured'],
    ['Commitment has already been settled', 'already_settled'],
    ['Commitment is disputed and cannot be settled', 'disputed'],
    ['Commitment was closed through early exit', 'early_exit'],
    ['Unexpected settlement preflight response', 'unknown'],
    [undefined, 'unknown'],
  ] as const)('maps %s to %s copy', (reason, category) => {
    expect(getSettlementIneligibleReasonCopy(reason).category).toBe(category);
  });

  it('maps a not-matured reason to a temporary layout and details CTA', () => {
    renderSettlementModal({
      ineligibleReason: 'Commitment has not matured yet and cannot be settled.',
    });

    expect(screen.getByRole('alert').getAttribute('data-reason-category')).toBe('not_matured');
    expect(screen.getByText('Temporary blocker')).toBeTruthy();
    expect(screen.getByText('Temporary reason: action can be retried later.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View maturity details' }).getAttribute('href')).toBe(
      '/commitments/CMT-123',
    );
  });

  it('maps an already-settled reason to a terminal settlement CTA', () => {
    renderSettlementModal({
      ineligibleReason: 'Commitment has already been settled',
    });

    expect(screen.getByRole('alert').getAttribute('data-reason-category')).toBe('already_settled');
    expect(screen.getByText('Terminal state')).toBeTruthy();
    expect(screen.getByText('Terminal reason: settlement cannot be retried for this state.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View settlement details' }).getAttribute('href')).toBe(
      '/commitments/CMT-123',
    );
  });

  it('maps a violated settlement response to a disputed remediation CTA', () => {
    renderSettlementModal({
      ineligibleReason: 'Commitment has been violated and cannot be settled',
    });

    expect(screen.getByRole('alert').getAttribute('data-reason-category')).toBe('disputed');
    expect(screen.getByText('Commitment is disputed')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review dispute details' }).getAttribute('href')).toBe(
      '/commitments/CMT-123',
    );
  });

  it('maps an early-exit settlement response to a terminal details CTA', () => {
    renderSettlementModal({
      ineligibleReason: 'Commitment has already been exited early',
    });

    expect(screen.getByRole('alert').getAttribute('data-reason-category')).toBe('early_exit');
    expect(screen.getByText('Commitment was exited early')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review exit details' }).getAttribute('href')).toBe(
      '/commitments/CMT-123',
    );
  });

  it('uses a safe default for unknown reasons', () => {
    renderSettlementModal({
      ineligibleReason: 'Unexpected settlement preflight response',
    });

    expect(getSettlementIneligibleReasonCopy('Unexpected settlement preflight response').category).toBe(
      'unknown',
    );
    expect(screen.getByRole('alert').getAttribute('data-reason-category')).toBe('unknown');
    expect(screen.getByText('Settlement is unavailable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review commitment details' }).getAttribute('href')).toBe(
      '/commitments/CMT-123',
    );
  });

  it('uses the same safe default when reason text is missing', () => {
    renderSettlementModal();

    expect(screen.getByRole('alert').getAttribute('data-reason-category')).toBe('unknown');
    expect(screen.getByText('Unknown reason: review before taking action.')).toBeTruthy();
    expect(screen.queryByText('Reason from settlement check:')).toBeNull();
  });

  it('wires Return to dashboard as the primary action', () => {
    const onReturnToDashboard = vi.fn();

    renderSettlementModal({
      onReturnToDashboard,
      ineligibleReason: 'Commitment has not matured yet and cannot be settled.',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Return to dashboard' }));

    expect(onReturnToDashboard).toHaveBeenCalledOnce();
  });

  it('does not render when closed', () => {
    renderSettlementModal({ isOpen: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('wires close controls when provided', () => {
    const onClose = vi.fn();

    renderSettlementModal({
      onClose,
      ineligibleReason: 'Commitment has not matured yet and cannot be settled.',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close settlement modal' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn();

    renderSettlementModal({
      onClose,
      ineligibleReason: 'Commitment has not matured yet and cannot be settled.',
    });

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders the settled state and dashboard action', () => {
    const onReturnToDashboard = vi.fn();

    renderSettlementModal({
      state: 'settled',
      settlementAmount: '100 XLM',
      onReturnToDashboard,
    });

    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBe('settlement-success-title');
    expect(screen.getByText('Settlement complete')).toBeTruthy();
    expect(screen.getByText('100 XLM')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Return to dashboard' }));

    expect(onReturnToDashboard).toHaveBeenCalledOnce();
  });
});
