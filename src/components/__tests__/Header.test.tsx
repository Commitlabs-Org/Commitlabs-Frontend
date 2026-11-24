import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalletState } from '@/lib/wallet';
import { Header } from '../Header';
import { WalletProvider } from '../WalletProvider';

const { connectFreighterMock, usePathnameMock } = vi.hoisted(() => ({
  connectFreighterMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));

vi.mock('@/lib/wallet', () => ({ connectFreighter: connectFreighterMock }));
vi.mock('next/navigation', () => ({ usePathname: usePathnameMock }));

function renderHeader() {
  return render(
    <WalletProvider>
      <Header />
    </WalletProvider>,
  );
}

describe('Header', () => {
  beforeEach(() => {
    connectFreighterMock.mockReset();
    usePathnameMock.mockReturnValue('/');
  });

  it('shows Connect wallet when idle', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: 'Connect wallet' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('shows Connecting... and disables the button while connecting', async () => {
    let resolveConnection!: (state: WalletState) => void;
    connectFreighterMock.mockReturnValue(
      new Promise<WalletState>((resolve) => {
        resolveConnection = resolve;
      }),
    );
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));

    const connectingButton = screen.getByRole('button', { name: 'Connecting...' });
    expect(connectingButton.hasAttribute('disabled')).toBe(true);

    await act(async () => {
      resolveConnection({ status: 'connected', address: 'GABC1234XYZW5678', message: null });
    });
  });

  it('shows the shortened address and disconnect control when connected', async () => {
    connectFreighterMock.mockResolvedValue({
      status: 'connected',
      address: 'GABC1234XYZW5678',
      message: null,
    });
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));

    const disconnectButton = await screen.findByRole('button', { name: 'GABC...5678' });
    expect(disconnectButton.getAttribute('title')).toBe('Disconnect wallet');
    fireEvent.click(disconnectButton);
    expect(screen.getByRole('button', { name: 'Connect wallet' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('marks the active route with aria-current="page"', () => {
    usePathnameMock.mockReturnValue('/dashboard/active');
    renderHeader();

    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('link', { name: 'Create' }).getAttribute('aria-current')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderHeader();

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
