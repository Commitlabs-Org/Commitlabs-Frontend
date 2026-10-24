import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PausedBanner, PAUSED_BANNER_TEXT } from '../PausedBanner';
import { ProtocolStatusProvider } from '../ProtocolStatusProvider';
import { WalletProvider } from '../WalletProvider';
import * as statusHook from '../ProtocolStatusProvider';
import CreatePage from '@/app/create/page';
import DashboardPage from '@/app/dashboard/page';
import * as commitmentsModule from '@/lib/commitments';

vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  const escrowContractId = 'CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4';
  return { ...actual, ESCROW_CONTRACT_ID: escrowContractId, config: { ...actual.config, escrowContractId } };
});


// Mock commitments data for dashboard test
vi.mock('@/lib/commitments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/commitments')>();
  return {
    ...actual,
    loadCommitments: vi.fn(),
    subscribeCommitments: vi.fn(() => () => {}),
  };
});

describe('PausedBanner', () => {
  it('renders with role="status" and exact text when paused: true', () => {
    vi.spyOn(statusHook, 'useProtocolStatus').mockReturnValue({
      status: 'ok',
      paused: true,
      yieldPool: 1000n,
      fetchedAt: Date.now(),
      refresh: async () => {},
    });

    render(<PausedBanner />);

    const banner = screen.getByRole('status');
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain(PAUSED_BANNER_TEXT);
  });

  it('renders nothing when paused: false', () => {
    vi.spyOn(statusHook, 'useProtocolStatus').mockReturnValue({
      status: 'ok',
      paused: false,
      yieldPool: 1000n,
      fetchedAt: Date.now(),
      refresh: async () => {},
    });

    render(<PausedBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders nothing when status is unavailable (even on RPC failure)', () => {
    vi.spyOn(statusHook, 'useProtocolStatus').mockReturnValue({
      status: 'unavailable',
      paused: false,
      yieldPool: 0n,
      fetchedAt: Date.now(),
      refresh: async () => {},
    });

    render(<PausedBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Action gating when contract is paused', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables wizard submit button with reason text when paused: true', () => {
    vi.spyOn(statusHook, 'useProtocolStatus').mockReturnValue({
      status: 'ok',
      paused: true,
      yieldPool: 1000n,
      fetchedAt: Date.now(),
      refresh: async () => {},
    });

    // Render CreatePage
    render(
      <WalletProvider>
        <CreatePage />
      </WalletProvider>
    );

    // Step 0 -> Continue
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueBtn);

    // Step 1 -> Review
    const reviewBtn = screen.getByRole('button', { name: /review/i });
    fireEvent.click(reviewBtn);

    // Step 2: checkbox agreement
    const agreeCheck = screen.getByRole('checkbox');
    fireEvent.click(agreeCheck);

    // The submit button must be disabled with reason text
    const submitBtn = screen.getByRole('button', { name: /create commitment/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    // Inline reason text is displayed
    const reasonText = screen.getByText(/Commitment creation is temporarily paused by the contract operator/i);
    expect(reasonText).toBeDefined();
  });

  it('disables dashboard early exit button with reason text while keeping settle enabled', () => {
    vi.spyOn(statusHook, 'useProtocolStatus').mockReturnValue({
      status: 'ok',
      paused: true,
      yieldPool: 1000n,
      fetchedAt: Date.now(),
      refresh: async () => {},
    });

    // Provide one active commitment (can exit) and one matured commitment (can settle)
    vi.mocked(commitmentsModule.loadCommitments).mockReturnValue({
      items: [
        {
          id: 'CMT-ACTIVE-1',
          type: 'balanced',
          asset: 'USDC',
          amount: '10000000000',
          durationDays: 30,
          maxLoss: 8,
          penalty: 5,
          apy: 9,
          createdAt: Date.now(),
          status: 'active',
          owner: 'GUSER1',
          txHash: '0x123',
        },
        {
          id: 'CMT-MATURED-2',
          type: 'safe',
          asset: 'USDC',
          amount: '5000000000',
          durationDays: 7,
          maxLoss: 2,
          penalty: 3,
          apy: 4.5,
          createdAt: Date.now() - 10 * 86_400_000,
          status: 'active', // effectiveStatus will be 'matured'
          owner: 'GUSER1',
          txHash: '0x456',
        },
      ],
      dropped: 0,
      corrupt: false,
      storageUnavailable: false,
    });

    render(
      <WalletProvider>
        <DashboardPage />
      </WalletProvider>
    );

    // Early exit button is disabled with the pause reason
    const exitBtn = screen.getByRole('button', { name: /early exit/i }) as HTMLButtonElement;
    expect(exitBtn.disabled).toBe(true);
    expect(
      screen.getByText(/Early exits are temporarily disabled while the contract is paused/i),
    ).toBeDefined();

    // Settle button remains enabled!
    const settleBtn = screen.getByRole('button', { name: /settle/i }) as HTMLButtonElement;
    expect(settleBtn.disabled).toBe(false);
  });
});
