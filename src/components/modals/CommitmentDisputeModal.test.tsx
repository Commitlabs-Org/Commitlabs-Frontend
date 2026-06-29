// @vitest-environment happy-dom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommitmentDisputeModal from '@/components/modals/CommitmentDisputeModal';

const DEFAULT_PROPS = {
  isOpen: true,
  commitmentId: 'CMT-TEST1234',
  onClose: vi.fn(),
};

function renderModal(
  overrides: Partial<React.ComponentProps<typeof CommitmentDisputeModal>> = {},
) {
  const props = { ...DEFAULT_PROPS, ...overrides };
  const view = render(<CommitmentDisputeModal {...props} />);
  return { props, ...view };
}

describe('CommitmentDisputeModal', () => {
  beforeEach(() => {
    // Reset body style
    document.body.style.overflow = '';
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.body.style.overflow = '';
  });

  it('does not render when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders correctly when isOpen is true', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dispute commitment' })).toBeTruthy();
    expect(screen.getByText(/CMT-TEST1234/)).toBeTruthy();
  });

  it('disables the submit button if the reason is empty or whitespace', () => {
    renderModal();
    const submitBtn = screen.getByRole('button', { name: /submit dispute/i });
    expect(submitBtn).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/describe the issue/i);
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(submitBtn).toBeDisabled();
  });

  it('enables the submit button when reason is entered', () => {
    renderModal();
    const submitBtn = screen.getByRole('button', { name: /submit dispute/i });
    const textarea = screen.getByPlaceholderText(/describe the issue/i);

    fireEvent.change(textarea, { target: { value: 'This commitment is invalid' } });
    expect(submitBtn).not.toBeDisabled();
  });

  it('submits the dispute successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })
    );

    renderModal();
    const textarea = screen.getByPlaceholderText(/describe the issue/i);
    const submitBtn = screen.getByRole('button', { name: /submit dispute/i });

    fireEvent.change(textarea, { target: { value: 'Some dispute reason' } });
    fireEvent.click(submitBtn);

    // Should display submitting state
    expect(screen.getByRole('button', { name: /submitting dispute/i })).toBeTruthy();

    // Wait for success status
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.getByText(/dispute submitted/i)).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/commitments/CMT-TEST1234/dispute',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Some dispute reason' }),
      })
    );
  });

  it('handles submission errors from server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Specific dispute submission failure error message' }),
      })
    );

    renderModal();
    const textarea = screen.getByPlaceholderText(/describe the issue/i);
    const submitBtn = screen.getByRole('button', { name: /submit dispute/i });

    fireEvent.change(textarea, { target: { value: 'Bad reason' } });
    fireEvent.click(submitBtn);

    // Wait for error alert
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Specific dispute submission failure error message')).toBeTruthy();
    });
  });

  it('handles network error during submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

    renderModal();
    const textarea = screen.getByPlaceholderText(/describe the issue/i);
    const submitBtn = screen.getByRole('button', { name: /submit dispute/i });

    fireEvent.change(textarea, { target: { value: 'Network offline reason' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Network error. Check your connection and try again.')).toBeTruthy();
    });
  });

  it('calls onClose when close button or cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    // Click Close modal button (X)
    fireEvent.click(screen.getByRole('button', { name: 'Close dispute modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click Cancel button
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('locks body scroll while open', () => {
    renderModal();
    expect(document.body.style.overflow).toBe('hidden');
  });
});
