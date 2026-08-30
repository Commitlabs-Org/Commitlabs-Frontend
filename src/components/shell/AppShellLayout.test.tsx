/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppShellLayout } from './AppShellLayout';
import { AppSidebar } from './AppSidebar';

const walletState = {
  address: '',
  connected: false,
  walletNetwork: null as string | null,
};

vi.mock('next/navigation', () => ({
  usePathname: () => '/create',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => walletState,
}));

const ADDRESS = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';
const NETWORK = 'Test SDF Network ; September 2015';

describe('AppShellLayout navigation boundary', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    walletState.address = '';
    walletState.connected = false;
    walletState.walletNetwork = null;
  });

  it('recovers a disconnected wallet on a protected page without dropping the chrome', () => {
    render(
      <AppShellLayout>
        <div>Secret create form</div>
      </AppShellLayout>,
    );

    expect(screen.queryByText('Secret create form')).toBeNull();
    expect(screen.getByTestId('shell-boundary-failure')).toHaveAttribute(
      'data-error-code',
      'DISCONNECTED_WALLET',
    );
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry navigation' })).toBeTruthy();
  });

  it('renders protected content once wallet identity and network are verified', () => {
    walletState.address = ADDRESS;
    walletState.connected = true;
    walletState.walletNetwork = NETWORK;

    render(
      <AppShellLayout>
        <div>Secret create form</div>
      </AppShellLayout>,
    );

    expect(screen.getByText('Secret create form')).toBeTruthy();
    expect(screen.getByTestId('shell-boundary-ready')).toBeTruthy();
  });

  it('rejects a malformed session snapshot even when the client claims to be connected', () => {
    walletState.address = ADDRESS;
    walletState.connected = true;
    walletState.walletNetwork = NETWORK;

    render(
      <AppShellLayout sessionSnapshot={{ address: '0xnotstellar' }}>
        <div>Secret create form</div>
      </AppShellLayout>,
    );

    expect(screen.queryByText('Secret create form')).toBeNull();
    expect(screen.getByTestId('shell-boundary-failure')).toHaveAttribute(
      'data-error-code',
      'MALFORMED_RESPONSE',
    );
  });
});

describe('AppSidebar hostile navigation', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('blocks a protected destination when the wallet is disconnected', () => {
    render(<AppSidebar auth={{ connected: false }} />);
    fireEvent.click(screen.getByRole('link', { name: 'Create commitment' }));
    expect(screen.getByTestId('shell-nav-blocked')).toHaveAttribute(
      'data-error-code',
      'DISCONNECTED_WALLET',
    );
  });

  it('allows overview without a wallet', () => {
    render(<AppSidebar auth={{ connected: false }} />);
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));
    expect(screen.queryByTestId('shell-nav-blocked')).toBeNull();
  });
});
