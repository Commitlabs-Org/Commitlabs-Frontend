/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PurchaseSuccessModal from '@/components/modals/PurchaseSuccessModal';

const DEFAULT_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  commitmentId: '42',
  commitmentType: 'Safe Commitment',
  pricePaid: '1,000 USDC',
  onViewCommitments: vi.fn(),
};

function renderModal(
  overrides: Partial<React.ComponentProps<typeof PurchaseSuccessModal>> = {},
) {
  const props = { ...DEFAULT_PROPS, ...overrides };
  const view = render(<PurchaseSuccessModal {...props} />);
  return { props, ...view };
}

describe('PurchaseSuccessModal', () => {
  beforeEach(() => {
    // Mock clipboard API — navigator.clipboard is a non-writable getter so we
    // must use defineProperty rather than Object.assign.
    const clipboardMock = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog when isOpen is true', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows the success heading', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Purchase Successful' })).toBeTruthy();
  });

  it('displays formatted commitment id', () => {
    renderModal({ commitmentId: '7' });
    expect(screen.getByText('#CMT-007')).toBeTruthy();
  });

  it('displays commitment type', () => {
    renderModal({ commitmentType: 'Balanced Commitment' });
    expect(screen.getByText('Balanced Commitment')).toBeTruthy();
  });

  it('displays price paid', () => {
    renderModal({ pricePaid: '500 XLM' });
    expect(screen.getByText('500 XLM')).toBeTruthy();
  });

  // ── Transaction hash ───────────────────────────────────────────────────────

  it('shows truncated tx hash when provided', () => {
    renderModal({ txHash: 'abcdefgh12345678ijklmnop87654321' });
    // truncated: first 8 + '...' + last 8
    expect(screen.getByText('abcdefgh...87654321')).toBeTruthy();
  });

  it('shows hash unavailable message when txHash is undefined', () => {
    renderModal({ txHash: undefined });
    expect(screen.getByText('Transaction hash unavailable.')).toBeTruthy();
  });

  it('shows explorer link when txHash is provided', () => {
    renderModal({ txHash: 'deadbeef00000000cafebabe11111111' });
    const link = screen.getByRole('link', { name: /View on Stellar Explorer/i });
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain('deadbeef00000000cafebabe11111111');
  });

  it('does not show explorer link when txHash is absent', () => {
    renderModal({ txHash: undefined });
    expect(screen.queryByRole('link', { name: /View on Stellar Explorer/i })).toBeNull();
  });

  // ── Copy hash ──────────────────────────────────────────────────────────────

  it('copy button calls clipboard.writeText with full hash', async () => {
    const hash = 'fullhashvalue1234567890abcdef00';
    renderModal({ txHash: hash });
    fireEvent.click(screen.getByRole('button', { name: 'Copy transaction hash' }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(hash);
    });
  });

  it('shows "Copied!" status after copy', async () => {
    renderModal({ txHash: 'abc123def456abc7' });
    fireEvent.click(screen.getByRole('button', { name: 'Copy transaction hash' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.getByRole('status').textContent).toBe('Copied!');
    });
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  it('calls onViewCommitments when CTA button is clicked', () => {
    const onViewCommitments = vi.fn();
    renderModal({ onViewCommitments });
    fireEvent.click(screen.getByRole('button', { name: /View in My Commitments/i }));
    expect(onViewCommitments).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Focus management ───────────────────────────────────────────────────────

  it('dialog has aria-modal="true"', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('dialog is labelled by heading id', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-labelledby',
      'purchase-success-title',
    );
  });

  it('dialog is described by description id', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-describedby',
      'purchase-success-description',
    );
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('handles short txHash without truncation', () => {
    renderModal({ txHash: 'short' });
    expect(screen.getByText('short')).toBeTruthy();
  });

  it('pads commitment id with leading zeros to 3 digits', () => {
    renderModal({ commitmentId: '1' });
    expect(screen.getByText('#CMT-001')).toBeTruthy();
  });

  it('does not show copy button when txHash is missing', () => {
    renderModal({ txHash: undefined });
    expect(screen.queryByRole('button', { name: 'Copy transaction hash' })).toBeNull();
  });
});
