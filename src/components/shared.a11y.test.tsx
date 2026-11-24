import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from '@/test/axe';
import { NetworkProvider } from '@/components/NetworkProvider';
import { Header } from './Header';
import { Footer } from './Footer';
import { PausedBanner } from './PausedBanner';
import { WalletNotice } from './WalletNotice';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

const walletState = {
  status: 'disconnected' as 'disconnected' | 'connecting' | 'connected',
  address: null as string | null,
  message: 'Freighter extension not found. Running in demo mode.' as string | null,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('./WalletProvider', () => ({
  useWallet: () => walletState,
}));

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => walletState,
}));

vi.mock('./ProtocolStatusProvider', () => ({
  useProtocolStatus: () => ({ status: 'ok', paused: true }),
}));

vi.mock('@/lib/soroban/admin', () => ({
  getAdmin: vi.fn().mockResolvedValue(null),
}));

describe('Shared components accessibility', () => {
  it('Header has no axe violations (disconnected)', async () => {
    walletState.status = 'disconnected';
    walletState.address = null;
    const { container } = render(
      <NetworkProvider>
        <Header />
      </NetworkProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Header has no axe violations (connected)', async () => {
    walletState.status = 'connected';
    walletState.address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const { container } = render(
      <NetworkProvider>
        <Header />
      </NetworkProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Footer has no axe violations', async () => {
    walletState.status = 'disconnected';
    walletState.address = null;
    const { container } = render(
      <NetworkProvider>
        <Footer />
      </NetworkProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('PausedBanner has no axe violations when paused', async () => {
    const { container } = render(<PausedBanner />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('WalletNotice has no axe violations when showing a message', async () => {
    walletState.status = 'disconnected';
    walletState.message = 'Freighter extension not found. Running in demo mode.';
    const { container } = render(<WalletNotice />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
