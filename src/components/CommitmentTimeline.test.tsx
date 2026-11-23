import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchEscrowEvents, type FetchEventsResult } from '@/lib/soroban/events';
import { CommitmentTimeline } from './CommitmentTimeline';

vi.mock('@/lib/soroban/events', async () => {
  const actual = await vi.importActual<typeof import('@/lib/soroban/events')>(
    '@/lib/soroban/events'
  );
  return {
    ...actual,
    fetchEscrowEvents: vi.fn(),
  };
});

function event(
  id: string,
  kind: string,
  ledger: number,
  overrides: Partial<FetchEventsResult['events'][number]> = {}
): FetchEventsResult['events'][number] {
  return {
    id,
    kind,
    commitmentId: '42',
    amount: '10000000',
    ledger,
    txHash: '',
    at: new Date(1700000000000 + ledger * 1000).toISOString(),
    ...overrides,
  };
}

function result(
  events: FetchEventsResult['events'],
  options: Partial<FetchEventsResult> = {}
): FetchEventsResult {
  return {
    events,
    cursor: undefined,
    latestLedger: 100,
    rawCount: events.length,
    hasMore: false,
    olderEventsAvailable: false,
    ...options,
  };
}

describe('CommitmentTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchEscrowEvents).mockResolvedValue(result([]));
  });

  it('sorts events newest first and deduplicates by event ID', async () => {
    vi.mocked(fetchEscrowEvents).mockResolvedValue(
      result([
        event('old', 'create_commitment', 10),
        event('duplicate', 'refund', 12),
        event('duplicate', 'release', 20, { txHash: 'transaction-hash' }),
      ])
    );

    render(<CommitmentTimeline commitmentId="42" />);
    const list = await screen.findByRole('list', {
      name: 'Lifecycle events for commitment 42, newest first',
    });
    const items = within(list).getAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('release');
    expect(items[1].textContent).toContain('create_commitment');
    expect(items[0].textContent).toContain('10,000,000 units');
    expect(items[0].textContent).toContain('2023-11-14');
    expect(within(items[0]).getByRole('link', { name: 'View transaction' }).getAttribute('href')).toContain(
      '/tx/'
    );
  });

  it('loads older events with the cursor returned by the first page', async () => {
    vi.mocked(fetchEscrowEvents)
      .mockResolvedValueOnce(
        result([event('new', 'release', 20)], {
          cursor: 'cursor-page-one',
          hasMore: true,
          olderEventsAvailable: true,
        })
      )
      .mockResolvedValueOnce(result([event('old', 'fund_escrow', 10)]));

    render(<CommitmentTimeline commitmentId="42" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load older' }));

    await waitFor(() => {
      expect(fetchEscrowEvents).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          filters: { commitmentId: '42' },
          cursor: 'cursor-page-one',
        })
      );
    });
    expect(await screen.findByText('fund_escrow')).toBeTruthy();
  });

  it('explains when events fall outside the RPC retention window', async () => {
    vi.mocked(fetchEscrowEvents).mockResolvedValue(
      result([], {
        retentionOutOfRange: true,
        retentionMessage: 'Requested events are outside the Soroban RPC retention window.',
      })
    );

    render(<CommitmentTimeline commitmentId="42" />);
    expect(await screen.findByText(/outside the Soroban RPC retention window/i)).toBeTruthy();
  });

  it('renders an empty state when no events are available', async () => {
    render(<CommitmentTimeline commitmentId="42" />);
    expect(await screen.findByText('No lifecycle events found for this commitment.')).toBeTruthy();
  });

  it('shows an error and retry action when events fail to load', async () => {
    vi.mocked(fetchEscrowEvents).mockRejectedValueOnce(new Error('RPC unavailable'));

    render(<CommitmentTimeline commitmentId="42" />);
    expect((await screen.findByRole('alert')).textContent).toContain('RPC unavailable');
    expect(screen.getByRole('button', { name: 'Retry loading events' })).toBeTruthy();
  });
});
