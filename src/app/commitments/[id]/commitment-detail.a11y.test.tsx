import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from '@/test/axe';
import { NetworkProvider } from '@/components/NetworkProvider';
import CommitmentDetailPage from './page';

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ status: 'disconnected', address: null }),
}));

vi.mock('@/components/CommitmentTimeline', () => ({
  CommitmentTimeline: () => <section aria-label="Event timeline">Timeline</section>,
}));

vi.mock('@/components/TransferPanel', () => ({
  TransferPanel: () => null,
}));

vi.mock('@/lib/soroban/read', () => ({
  validateCommitmentId: (id: string) =>
    /^\d+$/.test(id) ? { valid: true } : { valid: false, error: 'Commitment ID must be numeric.' },
  getCommitment: vi.fn().mockResolvedValue({
    id: '42',
    owner: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    asset: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    amount: 1000,
    accruedYield: 50,
    complianceScore: 95,
    risk: 'Balanced',
    penaltyBps: 500,
    status: 'Funded',
    createdAt: 1700000000,
    maturity: 1710000000,
    metadata: { strategy: 'balanced-v1' },
  }),
  getAttestations: vi.fn().mockResolvedValue([
    {
      attestor: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBX7A',
      complianceScore: 95,
      timestamp: 1705000000,
    },
  ]),
  getDispute: vi.fn().mockResolvedValue(null),
  isNotFoundError: () => false,
  formatRelativeTime: () => '2 days ago',
  formatAbsoluteTime: () => '2026-01-01 00:00:00 UTC',
}));

describe('Commitment detail page (/commitments/[id]) accessibility', () => {
  it('has no axe violations when loaded', async () => {
    const { container } = render(
      <NetworkProvider>
        <main id="main-content">
          <CommitmentDetailPage params={{ id: '42' }} />
        </main>
      </NetworkProvider>,
    );
    await screen.findByRole('heading', { name: /Commitment #42/i });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations for an invalid commitment ID', async () => {
    const { container } = render(
      <NetworkProvider>
        <main id="main-content">
          <CommitmentDetailPage params={{ id: 'invalid-id' }} />
        </main>
      </NetworkProvider>,
    );
    expect(await screen.findByRole('heading', { name: /Invalid Commitment ID/i })).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });
});
