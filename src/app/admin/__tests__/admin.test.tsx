import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminPage from '../page';
import { Footer } from '@/components/Footer';
import * as adminModule from '@/lib/soroban/admin';
import * as walletHook from '@/components/WalletProvider';
import * as statusHook from '@/components/ProtocolStatusProvider';

import { Keypair } from '@stellar/stellar-sdk';

const ADMIN_ADDRESS = Keypair.random().publicKey();
const NON_ADMIN_ADDRESS = Keypair.random().publicKey();
const PENDING_ADMIN_ADDRESS = Keypair.random().publicKey();
const VALID_FEE_RECIPIENT = Keypair.random().publicKey();

const mockRefreshProtocolStatus = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();

  vi.spyOn(adminModule, 'getAdmin').mockResolvedValue(ADMIN_ADDRESS);
  vi.spyOn(adminModule, 'getPendingAdmin').mockResolvedValue(PENDING_ADMIN_ADDRESS);
  vi.spyOn(adminModule, 'getIsPaused').mockResolvedValue(false);
  vi.spyOn(adminModule, 'getGracePeriod').mockResolvedValue(86400n);
  vi.spyOn(adminModule, 'getViolationThreshold').mockResolvedValue(80);

  vi.spyOn(adminModule, 'pause').mockResolvedValue({ transactionHash: 'hash_pause' });
  vi.spyOn(adminModule, 'unpause').mockResolvedValue({ transactionHash: 'hash_unpause' });
  vi.spyOn(adminModule, 'setGracePeriod').mockResolvedValue({ transactionHash: 'hash_grace' });
  vi.spyOn(adminModule, 'setViolationThreshold').mockResolvedValue({ transactionHash: 'hash_thresh' });
  vi.spyOn(adminModule, 'setFeeRecipient').mockResolvedValue({ transactionHash: 'hash_fee' });
  vi.spyOn(adminModule, 'proposeAdmin').mockResolvedValue({ transactionHash: 'hash_propose' });
  vi.spyOn(adminModule, 'cancelAdminProposal').mockResolvedValue({ transactionHash: 'hash_cancel' });

  vi.spyOn(statusHook, 'useProtocolStatus').mockReturnValue({
    status: 'ok',
    paused: false,
    yieldPool: 0n,
    fetchedAt: Date.now(),
    refresh: mockRefreshProtocolStatus,
  });
});

describe('Admin Page Gate and Controls', () => {
  it('non-admin wallet renders no write controls', async () => {
    vi.spyOn(walletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      address: NON_ADMIN_ADDRESS,
      message: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<AdminPage />);

    // Shows read-only overview
    await screen.findByText('Protocol Administration');
    expect(screen.getByText('Current Protocol Status')).toBeDefined();
    expect(screen.getByText(ADMIN_ADDRESS)).toBeDefined();
    expect(screen.getByText(PENDING_ADMIN_ADDRESS)).toBeDefined();
    expect(
      screen.getByText(/Your connected wallet is not the contract administrator/i),
    ).toBeDefined();

    // Verify NO write controls or submit buttons are rendered
    expect(screen.queryByRole('button', { name: /Pause Protocol/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Unpause Protocol/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Update Grace Period/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Update Violation Threshold/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Update Fee Recipient/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Propose Admin/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Cancel Admin Proposal/i })).toBeNull();
    expect(screen.queryByLabelText(/Grace Period/i)).toBeNull();
    expect(screen.queryByLabelText(/Violation Threshold/i)).toBeNull();
    expect(screen.queryByLabelText(/Fee Recipient/i)).toBeNull();
    expect(screen.queryByLabelText(/Propose New Admin/i)).toBeNull();
  });

  it('disconnected wallet renders no write controls', async () => {
    vi.spyOn(walletHook, 'useWallet').mockReturnValue({
      status: 'idle',
      address: null,
      message: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<AdminPage />);

    await screen.findByText('Protocol Administration');
    expect(
      screen.getByText(/Connect your wallet to access administrative controls/i),
    ).toBeDefined();

    expect(screen.queryByRole('button', { name: /Pause Protocol/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Update Grace Period/i })).toBeNull();
  });

  it('admin sees pause, grace period, threshold, fee recipient and handover forms', async () => {
    vi.spyOn(walletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      address: ADMIN_ADDRESS,
      message: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<AdminPage />);

    // Form cards / buttons visible to admin
    await screen.findByRole('button', { name: 'Pause Protocol' });
    expect(screen.getByRole('button', { name: 'Update Grace Period' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Update Violation Threshold' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Update Fee Recipient' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Propose Admin' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel Admin Proposal' })).toBeDefined();

    // Inputs visible to admin
    expect(screen.getByLabelText('Grace Period (seconds)')).toBeDefined();
    expect(screen.getByLabelText('Violation Threshold (0..=100)')).toBeDefined();
    expect(screen.getByLabelText('New Fee Recipient Address')).toBeDefined();
    expect(screen.getByLabelText('Propose New Admin Address')).toBeDefined();
  });

  it('pending admin address shown from get_pending_admin', async () => {
    vi.spyOn(walletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      address: ADMIN_ADDRESS,
      message: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<AdminPage />);

    await screen.findByText('Current Protocol Status');
    // Shown in the status table and in the pending admin banner
    const pendingMatches = screen.getAllByText(PENDING_ADMIN_ADDRESS);
    expect(pendingMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('grace period above max lock duration is rejected', async () => {
    vi.spyOn(walletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      address: ADMIN_ADDRESS,
      message: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<AdminPage />);

    const input = await screen.findByLabelText('Grace Period (seconds)');
    const submitBtn = screen.getByRole('button', { name: 'Update Grace Period' });

    // Enter value greater than 31,536,000 (365 days)
    const tooLarge = (adminModule.MAX_LOCK_DURATION_SECONDS + 1n).toString();
    fireEvent.change(input, { target: { value: tooLarge } });
    fireEvent.click(submitBtn);

    // Validation error displayed
    await screen.findByRole('alert');
    expect(screen.getByText(/exceeds maximum lock duration/i)).toBeDefined();

    // No dialog opened
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(adminModule.setGracePeriod).not.toHaveBeenCalled();
  });

  it('threshold 101 rejected, 0 and 100 accepted', async () => {
    vi.spyOn(walletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      address: ADMIN_ADDRESS,
      message: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<AdminPage />);

    const input = await screen.findByLabelText('Violation Threshold (0..=100)');
    const submitBtn = screen.getByRole('button', { name: 'Update Violation Threshold' });

    // 101 is rejected
    fireEvent.change(input, { target: { value: '101' } });
    fireEvent.click(submitBtn);

    await screen.findByText('Violation threshold must be between 0 and 100.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(adminModule.setViolationThreshold).not.toHaveBeenCalled();

    // 0 is accepted
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(submitBtn);

    // Confirm dialog opens
    const dialog0 = await screen.findByRole('dialog', { name: 'Update Violation Threshold?' });
    expect(dialog0).toBeDefined();
    // Cancel dialog to reset
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // 100 is accepted
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(submitBtn);

    const dialog100 = await screen.findByRole('dialog', { name: 'Update Violation Threshold?' });
    expect(dialog100).toBeDefined();
  });

  it('pause click invokes method pause after ConfirmDialog confirm', async () => {
    vi.spyOn(walletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      address: ADMIN_ADDRESS,
      message: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<AdminPage />);

    const pauseBtn = await screen.findByRole('button', { name: 'Pause Protocol' });
    fireEvent.click(pauseBtn);

    // ConfirmDialog opens
    const dialog = await screen.findByRole('dialog', { name: 'Pause Protocol Writes?' });
    expect(dialog).toBeDefined();

    // Click Pause button inside dialog
    const confirmBtn = screen.getByRole('button', { name: 'Pause' });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(adminModule.pause).toHaveBeenCalledWith(ADMIN_ADDRESS));
    // Should call provider's refresh so PausedBanner updates immediately
    expect(mockRefreshProtocolStatus).toHaveBeenCalled();
  });

  it('unpause click invokes method unpause and refreshes protocol status', async () => {
    vi.spyOn(adminModule, 'getIsPaused').mockResolvedValue(true);
    vi.spyOn(walletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      address: ADMIN_ADDRESS,
      message: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<AdminPage />);

    const unpauseBtn = await screen.findByRole('button', { name: 'Unpause Protocol' });
    fireEvent.click(unpauseBtn);

    const dialog = await screen.findByRole('dialog', { name: 'Resume Protocol Writes?' });
    expect(dialog).toBeDefined();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(adminModule.unpause).toHaveBeenCalledWith(ADMIN_ADDRESS));
    expect(mockRefreshProtocolStatus).toHaveBeenCalled();
  });

  it('fee recipient update validates and invokes contract after confirmation', async () => {
    vi.spyOn(walletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      address: ADMIN_ADDRESS,
      message: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<AdminPage />);

    const input = await screen.findByLabelText('New Fee Recipient Address');
    const submitBtn = screen.getByRole('button', { name: 'Update Fee Recipient' });

    fireEvent.change(input, { target: { value: VALID_FEE_RECIPIENT } });
    fireEvent.click(submitBtn);

    const dialog = await screen.findByRole('dialog', { name: 'Update Fee Recipient?' });
    expect(dialog).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(adminModule.setFeeRecipient).toHaveBeenCalledWith({
        newFeeRecipient: VALID_FEE_RECIPIENT,
        caller: ADMIN_ADDRESS,
      }),
    );
  });

  it('displays TxErrorNotice when a write operation fails', async () => {
    vi.spyOn(adminModule, 'pause').mockRejectedValue(new Error('Freighter rejected signature'));
    vi.spyOn(walletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      address: ADMIN_ADDRESS,
      message: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<AdminPage />);

    const pauseBtn = await screen.findByRole('button', { name: 'Pause Protocol' });
    fireEvent.click(pauseBtn);

    const confirmBtn = await screen.findByRole('button', { name: 'Pause' });
    fireEvent.click(confirmBtn);

    await screen.findByText(/Freighter rejected signature/i);
  });
});
