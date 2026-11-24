import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkProvider, useNetwork } from '../NetworkProvider';
import { NetworkNotice } from '../NetworkNotice';
import { NETWORK_STORAGE_KEY, NETWORK_COOKIE } from '@/lib/network';
import { config as buildConfig, explorerContractUrl, setActiveNetwork } from '@/lib/config';

// This sandbox's jsdom has no localStorage (pre-existing failures in other
// storage tests), so provide the small surface the provider uses.
const store = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  },
});

function Probe() {
  const { network, config, setNetwork, isContractConfigured } = useNetwork();
  return (
    <div>
      <span data-testid="network">{network}</span>
      <span data-testid="passphrase">{config.passphrase}</span>
      <span data-testid="rpc">{config.sorobanRpcUrl}</span>
      <span data-testid="explorer">{config.networkDetails.explorerBaseUrl}</span>
      <span data-testid="contract-link">{explorerContractUrl('CABC')}</span>
      <span data-testid="configured">{String(isContractConfigured)}</span>
      <button type="button" onClick={() => setNetwork('futurenet')}>
        futurenet
      </button>
      <button type="button" onClick={() => setNetwork('mainnet')}>
        mainnet
      </button>
    </div>
  );
}

describe('NetworkProvider', () => {
  beforeEach(() => {
    store.clear();
    document.cookie = `${NETWORK_COOKIE}=; path=/; max-age=0`;
    setActiveNetwork(buildConfig.network, {});
  });

  it('defaults to the build-time network', async () => {
    render(
      <NetworkProvider>
        <Probe />
      </NetworkProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('network').textContent).toBe(buildConfig.network);
    });
  });

  it('switching to futurenet updates passphrase, explorer URL and RPC and persists the choice', async () => {
    render(
      <NetworkProvider>
        <Probe />
      </NetworkProvider>,
    );

    fireEvent.click(screen.getByText('futurenet'));

    expect(screen.getByTestId('network').textContent).toBe('futurenet');
    expect(screen.getByTestId('passphrase').textContent).toBe(
      'Test SDF Future Network ; October 2022',
    );
    expect(screen.getByTestId('rpc').textContent).toBe('https://rpc-futurenet.stellar.org');
    expect(screen.getByTestId('explorer').textContent).toBe(
      'https://stellar.expert/explorer/futurenet',
    );
    expect(screen.getByTestId('contract-link').textContent).toContain(
      'https://stellar.expert/explorer/futurenet/contract/CABC',
    );
    expect(window.localStorage.getItem(NETWORK_STORAGE_KEY)).toBe('futurenet');
    expect(document.cookie).toContain(`${NETWORK_COOKIE}=futurenet`);
  });

  it('a network without a deployment has no contract configured', async () => {
    render(
      <NetworkProvider>
        <Probe />
      </NetworkProvider>,
    );

    fireEvent.click(screen.getByText('futurenet'));
    expect(screen.getByTestId('configured').textContent).toBe('false');
  });

  it('restores a persisted selection on load', async () => {
    window.localStorage.setItem(NETWORK_STORAGE_KEY, 'futurenet');

    render(
      <NetworkProvider>
        <Probe />
      </NetworkProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('network').textContent).toBe('futurenet');
    });
  });

  it('falls back to the env default when stored data is corrupt', async () => {
    window.localStorage.setItem(NETWORK_STORAGE_KEY, 'not-a-network');

    render(
      <NetworkProvider>
        <Probe />
      </NetworkProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('network').textContent).toBe(buildConfig.network);
    });
  });

  it('shows a warning banner on mainnet', async () => {
    render(
      <NetworkProvider>
        <NetworkNotice />
        <Probe />
      </NetworkProvider>,
    );

    fireEvent.click(screen.getByText('mainnet'));

    expect(screen.getByTestId('mainnet-warning')).toBeTruthy();
    expect(screen.getByTestId('mainnet-warning').textContent).toContain('real funds');
  });
});
