// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionProgressModal from './TransactionProgressModal';

const STORAGE_KEY = 'commitlabs.transactionProgressModal.v1';
const TX_HASH =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const renderModal = (
  props: Partial<React.ComponentProps<typeof TransactionProgressModal>> = {},
) =>
  render(
    <TransactionProgressModal
      isOpen={false}
      state="IDLE"
      actionName="Creating Commitment"
      onClose={vi.fn()}
      {...props}
    />,
  );

describe('TransactionProgressModal persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('persists an in-flight transaction with status and hash', async () => {
    renderModal({
      isOpen: true,
      state: 'PROCESSING',
      actionName: 'Creating Commitment',
      txHash: 'abc123',
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      state: 'PROCESSING',
      actionName: 'Creating Commitment',
      successMessage: 'Your transaction has been successfully processed.',
      txHash: 'abc123',
      errorCode: 'UNKNOWN_ERROR',
    });
  });

  it('rehydrates a failed transaction and keeps the hash affordances after reload', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: 'ERROR',
        actionName: 'Settling Funds',
        txHash: TX_HASH,
        errorCode: 'RPC_TIMEOUT',
      }),
    );

    renderModal();

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Network Timeout' })).toBeInTheDocument();
    expect(screen.getAllByText(TX_HASH)).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: /copy transaction hash/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view explorer/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('clears persisted state when the transaction reaches success', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: 'PROCESSING',
        actionName: 'Creating Commitment',
      }),
    );

    renderModal({
      isOpen: true,
      state: 'SUCCESS',
      actionName: 'Creating Commitment',
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  it('clears restored state when the user acknowledges a failed transaction', async () => {
    const onClose = vi.fn();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: 'ERROR',
        actionName: 'Settling Funds',
        errorCode: 'UNKNOWN_ERROR',
      }),
    );

    renderModal({ onClose });

    fireEvent.click(await screen.findByRole('button', { name: /close modal/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders normally when browser storage is unavailable', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    renderModal({
      isOpen: true,
      state: 'SUBMITTING',
      actionName: 'Creating Commitment',
      txHash: 'abc123',
    });

    expect(
      await screen.findByRole('heading', { name: 'Creating Commitment in Progress' }),
    ).toBeInTheDocument();
  });
});
