import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from '@/test/axe';
import ActivityPage from './page';

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ address: null }),
}));

vi.mock('@/lib/soroban/events', () => ({
  MAX_EVENTS_IN_MEMORY: 200,
  isLedgerOutOfRangeError: () => false,
  fetchEscrowEvents: vi.fn().mockResolvedValue({
    events: [
      {
        id: 'evt-1',
        kind: 'create_commitment',
        commitmentId: '42',
        owner: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        amount: '1000',
        ledger: 123456,
        at: '2026-01-01T00:00:00.000Z',
        txHash: 'abcdef1234567890',
      },
    ],
    cursor: 'cursor-1',
    olderEventsAvailable: false,
    retentionOutOfRange: false,
  }),
}));

describe('Activity page (/activity) accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <main id="main-content">
        <ActivityPage />
      </main>,
    );
    await screen.findByText('create_commitment');
    expect(await axe(container)).toHaveNoViolations();
  });
});
