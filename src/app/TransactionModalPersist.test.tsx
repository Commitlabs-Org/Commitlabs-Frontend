// @vitest-environment happy-dom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionProgressModal from './TransactionProgressModal';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'commitlabs-tx-progress';

function seedStorage(partial: Record<string, unknown>) {
  const envelope = {
    version: 1,
    data: { savedAt: Date.now(), ...partial },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

describe('TransactionProgressModal – persistence', () => {
  const noop = () => {};

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Reload re-opens at correct step
  // -------------------------------------------------------------------------
  it('re-opens at the correct step after reload using rehydrated state', () => {
    seedStorage({
      state: 'PROCESSING',
      timelinePhase: 'confirm',
      actionName: 'Settling Funds',
      txHash: 'hash-abc',
    });

    render(
      <TransactionProgressModal
        isOpen={false}
        state="IDLE"
        actionName=""
        onClose={noop}
      />,
    );

    // Modal should be visible even though isOpen=false because rehydrated state exists
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Confirming Transaction/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. Hash preserved across reload
  // -------------------------------------------------------------------------
  it('preserves the transaction hash in the rehydrated view', () => {
    const hash = 'stellar-tx-xyz789';
    seedStorage({
      state: 'ERROR',
      timelinePhase: 'submit',
      actionName: 'Creating Commitment',
      txHash: hash,
      errorCode: 'RPC_TIMEOUT',
    });

    render(
      <TransactionProgressModal
        isOpen={false}
        state="IDLE"
        actionName=""
        onClose={noop}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // The hash should appear in the explorer link row
    expect(screen.getByText(hash)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Terminal SUCCESS state clears storage
  // -------------------------------------------------------------------------
  it('clears persisted state when user closes from SUCCESS', () => {
    const onClose = vi.fn();

    render(
      <TransactionProgressModal
        isOpen={true}
        state="SUCCESS"
        actionName="Settling Funds"
        txHash="hash-done"
        onClose={onClose}
      />,
    );

    // Storage should have been written with terminal state written then cleared
    // Click the Close button to trigger handleClose
    const closeButtons = screen.getAllByRole('button');
    const closeBtn = closeButtons.find((b) => b.textContent === 'Close');
    expect(closeBtn).toBeDefined();

    act(() => {
      fireEvent.click(closeBtn!);
    });

    expect(onClose).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 4. Terminal ERROR acknowledged clears storage
  // -------------------------------------------------------------------------
  it('clears persisted state when user closes from ERROR', () => {
    const onClose = vi.fn();

    render(
      <TransactionProgressModal
        isOpen={true}
        state="ERROR"
        actionName="Settling Funds"
        errorCode="USER_REJECTED"
        onClose={onClose}
      />,
    );

    // The secondary "Close" button closes and acknowledges the error
    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(onClose).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 5. Storage-unavailable no-op
  // -------------------------------------------------------------------------
  it('renders without errors when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() =>
      render(
        <TransactionProgressModal
          isOpen={true}
          state="AWAITING_SIGNATURE"
          actionName="Test"
          onClose={noop}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 6. Live state takes precedence over rehydrated state
  // -------------------------------------------------------------------------
  it('uses live props when a non-IDLE state is provided, ignoring stale storage', () => {
    seedStorage({
      state: 'PROCESSING',
      timelinePhase: 'confirm',
      actionName: 'Old Action',
    });

    render(
      <TransactionProgressModal
        isOpen={true}
        state="AWAITING_SIGNATURE"
        actionName="New Action"
        onClose={noop}
      />,
    );

    expect(screen.getByText(/Confirm in Freighter/i)).toBeInTheDocument();
    expect(screen.queryByText(/Confirming Transaction/i)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 7. Nothing rendered when no props and no storage
  // -------------------------------------------------------------------------
  it('renders nothing when state is IDLE and storage is empty', () => {
    const { container } = render(
      <TransactionProgressModal
        isOpen={false}
        state="IDLE"
        actionName=""
        onClose={noop}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
