/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DisputeModal from '@/components/modals/DisputeModal';

const { mockUseWallet } = vi.hoisted(() => ({ mockUseWallet: vi.fn() }));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => mockUseWallet(),
}));

const fetchMock = vi.fn();

function renderModal() {
  const onClose = vi.fn();
  const onSubmitted = vi.fn();

  render(
    <DisputeModal
      isOpen
      commitmentId="cmt-123"
      onClose={onClose}
      onSubmitted={onSubmitted}
    />,
  );

  return { onClose, onSubmitted };
}

describe('DisputeModal', () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({
      address: 'GABC123',
      connected: true,
      connecting: false,
      error: null,
    });
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('allows users to pick a category and submit a dispute', async () => {
    const { onSubmitted } = renderModal();

    fireEvent.change(screen.getByLabelText(/dispute category/i), {
      target: { value: 'non_compliance' },
    });
    fireEvent.change(screen.getByLabelText(/reason for dispute/i), {
      target: { value: 'Pricing mismatch in the agreement' },
    });
    fireEvent.change(screen.getByLabelText(/evidence or notes/i), {
      target: { value: 'Invoice attached' },
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    fireEvent.click(screen.getByRole('button', { name: /submit dispute/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/commitments/cmt-123/dispute',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.reason).toBe('Pricing mismatch in the agreement');
    expect(body.evidence).toBe('Invoice attached');
    expect(body.callerAddress).toBe('GABC123');
    expect(onSubmitted).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/dispute submitted/i);
  });

  it('shows validation feedback when the reason is empty', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /submit dispute/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/provide a reason/i);
  });

  it.each([
    [400, /review your reason/i],
    [404, /could not be found/i],
    [409, /already has an active dispute/i],
    [429, /please wait a moment/i],
  ])('maps HTTP %s responses to user-friendly copy', async (status, expectedText) => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/reason for dispute/i), {
      target: { value: 'A reason for the dispute' },
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ error: 'bad request' }),
    } as Response);

    fireEvent.click(screen.getByRole('button', { name: /submit dispute/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(expectedText);
    });
  });

  it('disables submission and explains the wallet requirement when disconnected', () => {
    mockUseWallet.mockReturnValue({
      address: '',
      connected: false,
      connecting: false,
      error: null,
    });

    renderModal();

    const submitButton = screen.getByRole('button', { name: /submit dispute/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
  });

  it('closes on escape and traps focus while tabbing', () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole('dialog', { name: /dispute commitment/i });
    const closeButton = screen.getByRole('button', { name: /close dispute modal/i });
    const submitButton = screen.getByRole('button', { name: /submit dispute/i });

    closeButton.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(submitButton);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
