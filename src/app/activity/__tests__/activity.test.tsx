import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ActivityPage, { POLL_INTERVAL_MS } from '../page';
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
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    (walletHook.useWallet as any).mockReturnValue({
      status: 'connected',
      address: 'GABCD1234567890ABCDEFGHIJKLMNOPQRST',
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state initially then displays event rows and Load older button', async () => {
    vi.spyOn(eventsLib, 'fetchEscrowEvents').mockResolvedValue({
      events: mockEvents,
      cursor: 'cursor-1',
      latestLedger: 1010,
      rawCount: 30,
      hasMore: true,
      olderEventsAvailable: true,
    });

    render(<ActivityPage />);

    expect(screen.getByText(/Loading on-chain events/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('create_commitment')).toBeDefined();
      expect(screen.getByText('release')).toBeDefined();
      expect(screen.getByText('101')).toBeDefined();
      expect(screen.getByText('102')).toBeDefined();
      expect(screen.getAllByRole('button', { name: 'Copy address' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Copy transaction hash' })).toHaveLength(2);
      expect(screen.getByRole('button', { name: /Load older/i })).toBeDefined();
    });
  });

  it('renders empty state when no events exist', async () => {
    vi.spyOn(eventsLib, 'fetchEscrowEvents').mockResolvedValue({
      events: [],
      latestLedger: 1010,
      rawCount: 0,
      hasMore: false,
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
      rawCount: 2,
      hasMore: false,
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

  it('loads older events using pagination cursor when Load older is clicked', async () => {
    const olderEvent = {
      id: 'ev-older-1',
      kind: 'fund',
      commitmentId: '99',
      owner: 'GABCD1234567890ABCDEFGHIJKLMNOPQRST',
      amount: '150',
      ledger: 990,
      txHash: '0xhash0',
      at: '2026-03-01T09:50:00Z',
    };

    const fetchSpy = vi
      .spyOn(eventsLib, 'fetchEscrowEvents')
      .mockResolvedValueOnce({
        events: mockEvents,
        cursor: 'cursor-page-1',
        latestLedger: 1010,
        rawCount: 30,
        hasMore: true,
        olderEventsAvailable: true,
      })
      .mockResolvedValueOnce({
        events: [olderEvent],
        cursor: 'cursor-page-2',
        latestLedger: 1010,
        rawCount: 1,
        hasMore: false,
        olderEventsAvailable: false,
      });

    render(<ActivityPage />);

    const loadOlderBtn = await screen.findByRole('button', { name: /Load older/i });
    fireEvent.click(loadOlderBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: 'cursor-page-1',
        })
      );
      expect(screen.getByText('99')).toBeDefined();
      expect(screen.getByText(/Older events are not available from RPC/i)).toBeDefined();
    });
  });

  it('10s poll prepends one new event once, dedupes by id, and shows new events badge', async () => {
    vi.useFakeTimers();

    const newEvent = {
      id: 'ev-new-1',
      kind: 'fund',
      commitmentId: '205',
      owner: 'GABCD1234567890ABCDEFGHIJKLMNOPQRST',
      amount: '900',
      ledger: 1015,
      txHash: '0xhashnew',
      at: '2026-03-01T10:15:00Z',
    };

    const fetchSpy = vi
      .spyOn(eventsLib, 'fetchEscrowEvents')
      .mockResolvedValueOnce({
        events: mockEvents,
        cursor: 'cursor-initial',
        latestLedger: 1010,
        rawCount: 2,
        hasMore: false,
        olderEventsAvailable: false,
      })
      .mockResolvedValue({
        events: [newEvent, mockEvents[0]],
        cursor: 'cursor-latest',
        latestLedger: 1015,
        rawCount: 2,
        hasMore: false,
        olderEventsAvailable: false,
      });

    render(<ActivityPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('101')).toBeDefined();

    // First 10s poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        cursor: 'cursor-initial',
      })
    );
    expect(screen.getByText('205')).toBeDefined();
    expect(screen.getByRole('button', { name: /1 new events/i })).toBeDefined();

    // Second 10s poll returning same events -> deduped, count remains 1
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(screen.getAllByText('205')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /1 new events/i })).toBeDefined();
  });

  it('polling stops when document is hidden, when paused, and on unmount', async () => {
    vi.useFakeTimers();

    const fetchSpy = vi.spyOn(eventsLib, 'fetchEscrowEvents').mockResolvedValue({
      events: mockEvents,
      cursor: 'cursor-initial',
      latestLedger: 1010,
      rawCount: 2,
      hasMore: false,
      olderEventsAvailable: false,
    });

    const { unmount } = render(<ActivityPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Hide tab
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    fireEvent(document, new Event('visibilitychange'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Show tab again -> polling resumes on next interval
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    fireEvent(document, new Event('visibilitychange'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Pause live toggle stops polling
    const pauseBtn = screen.getByRole('button', { name: /Pause live/i });
    fireEvent.click(pauseBtn);
    expect(screen.getByRole('button', { name: /Resume live/i })).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Resume live and unmount -> no calls after unmount
    fireEvent.click(screen.getByRole('button', { name: /Resume live/i }));
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('shows explanatory retention message when startLedger is out of range', async () => {
    vi.spyOn(eventsLib, 'fetchEscrowEvents').mockResolvedValueOnce({
      events: [],
      latestLedger: 5000,
      rawCount: 0,
      hasMore: false,
      olderEventsAvailable: false,
      retentionOutOfRange: true,
      retentionMessage:
        'Requested startLedger is outside the Soroban RPC retention window. Showing available recent events within the retention range.',
    });

    render(<ActivityPage />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByText(/outside the Soroban RPC retention window/i)).toBeDefined();
    });
  });

  it('keeps the in-memory event list bounded at 500 items across polls', async () => {
    vi.useFakeTimers();

    const initial500 = Array.from({ length: 500 }, (_, idx) => ({
      id: `ev-${idx + 1}`,
      kind: 'fund',
      commitmentId: String(idx + 1),
      owner: 'GABCD1234567890ABCDEFGHIJKLMNOPQRST',
      amount: '10',
      ledger: 1000 + idx,
      txHash: `0xhash-${idx + 1}`,
      at: '2026-03-01T10:00:00Z',
    }));

    const incoming10 = Array.from({ length: 10 }, (_, idx) => ({
      id: `ev-new-${idx + 1}`,
      kind: 'release',
      commitmentId: `new-${idx + 1}`,
      owner: 'GABCD1234567890ABCDEFGHIJKLMNOPQRST',
      amount: '20',
      ledger: 2000 + idx,
      txHash: `0xhash-new-${idx + 1}`,
      at: '2026-03-01T11:00:00Z',
    }));

    vi.spyOn(eventsLib, 'fetchEscrowEvents')
      .mockResolvedValueOnce({
        events: initial500,
        cursor: 'cursor-500',
        latestLedger: 1500,
        rawCount: 500,
        hasMore: false,
        olderEventsAvailable: false,
      })
      .mockResolvedValueOnce({
        events: incoming10,
        cursor: 'cursor-510',
        latestLedger: 2010,
        rawCount: 10,
        hasMore: false,
        olderEventsAvailable: false,
      });

    const { container } = render(<ActivityPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelectorAll('tbody tr')).toHaveLength(500);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(500);
    expect(screen.getByText('new-1')).toBeDefined();
  });
});
