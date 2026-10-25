import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Commitment } from '@/lib/commitments';
import DashboardPage from './page';

const DAY = 86_400_000;
const base = {
  type: 'balanced',
  asset: 'USDC',
  maxLoss: 8,
  penalty: 5,
  apy: 9,
  owner: null,
  txHash: null,
} as const;

let seed: Commitment[] = [];

vi.mock('@/lib/commitments', async (orig) => ({
  ...(await orig<typeof import('@/lib/commitments')>()),
  loadCommitments: () => ({ items: seed, dropped: 0, corrupt: false, storageUnavailable: false }),
  saveCommitments: vi.fn(),
}));
vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ status: 'disconnected', address: null }),
}));
vi.mock('@/lib/wallet', () => ({ fetchXlmBalance: vi.fn().mockResolvedValue(null) }));

async function seriousViolations() {
  const res = await axe.run(document.body, {
    // jsdom has no layout/paint, so colour contrast cannot be computed
    rules: { 'color-contrast': { enabled: false } },
  });
  return res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

beforeEach(() => {
  const now = Date.now();
  seed = [
    { ...base, id: 'CMT-ACTIVE', amount: '10000000000', durationDays: 100, createdAt: now - 40 * DAY, status: 'active' },
    { ...base, id: 'CMT-MATURED', amount: '5000000000', durationDays: 10, createdAt: now - 20 * DAY, status: 'active' },
  ];
});

describe('dashboard accessibility', () => {
  it('has no serious axe violations, including with the dialog open', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await screen.findByText('Your commitments');
    expect(await seriousViolations()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Early exit' }));
    expect(screen.getByRole('dialog', { name: 'Exit early?' })).toBeTruthy();
    expect(await seriousViolations()).toEqual([]);
  });

  it('exposes progressbar value and text', async () => {
    render(<DashboardPage />);
    const bars = await screen.findAllByRole('progressbar');
    const active = bars.find((b) => b.getAttribute('aria-label')?.includes('CMT-ACTIVE'))!;
    expect(active.getAttribute('aria-valuemin')).toBe('0');
    expect(active.getAttribute('aria-valuemax')).toBe('100');
    expect(active.getAttribute('aria-valuenow')).toBe('40');
    expect(active.getAttribute('aria-valuetext')).toBe('40% elapsed, 60 days left');
  });

  it('shows the exit breakdown and announces the result', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(await screen.findByRole('button', { name: 'Early exit' }));
    const dlg = screen.getByRole('dialog', { name: 'Exit early?' });
    expect(within(dlg).getByText('950 USDC')).toBeTruthy(); // amount returned
    expect(within(dlg).getByText('50 USDC')).toBeTruthy(); // penalty amount
    await user.click(within(dlg).getByRole('button', { name: 'Exit early' }));
    await waitFor(() =>
      expect(screen.getAllByRole('status').some((s) => s.textContent === 'Commitment CMT-ACTIVE exited early')).toBe(
        true,
      ),
    );
  });

  it('announces settling', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(await screen.findByRole('button', { name: 'Settle' }));
    expect(screen.getAllByRole('status').some((s) => s.textContent === 'Commitment CMT-MATURED settled')).toBe(true);
  });
});
