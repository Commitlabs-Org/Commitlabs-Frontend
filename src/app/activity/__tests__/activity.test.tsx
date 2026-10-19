import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ActivityPage from '../page';
import * as eventsLib from '@/lib/soroban/events';
import * as walletHook from '@/components/WalletProvider';

vi.mock('@/components/WalletProvider', () => ({
  useWallet: vi.fn(),
}));

describe('ActivityPage Component', () => {
  const mockEvents = [
    {
      id: 'ev-1',
      kind: 'create_commitment',
      commitmentId: '101',
      owner: 'GABCD1234567890ABCDEFGHIJKLMNOPQRST',
      amount: '500',
      ledger: 1000,
      txHash: '0xhash1',
      at: '2026-03-01T10:00:00Z',
    },
    {
      id: 'ev-2',
      kind: 'release',
      commitmentId: '102',
      owner: 'GXYZ1234567890ABCDEFGHIJKLMNOPQRST',
      amount: '300',
      ledger: 1005,
      txHash: '0xhash2',
      at: '2026-03-01T10:05:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (walletHook.useWallet as any).mockReturnValue({
      status: 'connected',
      address: 'GABCD1234567890ABCDEFGHIJKLMNOPQRST',
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
  });

  it('renders loading state initially then displays event rows', async () => {
    vi.spyOn(eventsLib, 'fetchEscrowEvents').mockResolvedValue({
      events: mockEvents,
      latestLedger: 1010,
      olderEventsAvailable: true,
    });

    render(<ActivityPage />);

    expect(screen.getByText(/Loading on-chain events/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('create_commitment')).toBeDefined();
      expect(screen.getByText('release')).toBeDefined();
      expect(screen.getByText('101')).toBeDefined();
      expect(screen.getByText('102')).toBeDefined();
    });
  });

  it('renders empty state when no events exist', async () => {
    vi.spyOn(eventsLib, 'fetchEscrowEvents').mockResolvedValue({
      events: [],
      latestLedger: 1010,
      olderEventsAvailable: false,
    });

    render(<ActivityPage />);

    await waitFor(() => {
      expect(screen.getByText(/No events found matching criteria/i)).toBeDefined();
    });
  });

  it('displays RPC error state with retry button', async () => {
    vi.spyOn(eventsLib, 'fetchEscrowEvents').mockRejectedValueOnce(
      new Error('Soroban RPC timeout')
    );

    render(<ActivityPage />);

    await waitFor(() => {
      expect(screen.getByText(/RPC Error: Soroban RPC timeout/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined();
    });
  });

  it('updates filters when kind select changes', async () => {
    const fetchSpy = vi.spyOn(eventsLib, 'fetchEscrowEvents').mockResolvedValue({
      events: mockEvents,
      latestLedger: 1010,
      olderEventsAvailable: false,
    });

    render(<ActivityPage />);

    await waitFor(() => {
      expect(screen.getByText('create_commitment')).toBeDefined();
    });

    const select = screen.getByRole('combobox', { name: /Filter events by kind/i });
    fireEvent.change(select, { target: { value: 'fund' } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ kind: 'fund' }),
        })
      );
    });
  });
});
