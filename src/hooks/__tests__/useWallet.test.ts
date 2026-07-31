// @vitest-environment happy-dom

import { getAddress, getNetworkDetails } from '@stellar/freighter-api';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWallet } from '../useWallet';

vi.mock('@stellar/freighter-api', () => ({
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
}));

const getAddressMock = vi.mocked(getAddress);
const getNetworkDetailsMock = vi.mocked(getNetworkDetails);

describe('useWallet', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('auto-detects an already connected Freighter wallet on mount', async () => {
    getAddressMock.mockResolvedValue({ address: 'GCONNECTED' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.connected).toBe(true));

    expect(result.current.address).toBe('GCONNECTED');
    expect(result.current.error).toBeNull();
    expect(getAddressMock).toHaveBeenCalledTimes(1);
  });

  it('connect populates address and clears a prior rejected request error', async () => {
    getAddressMock
      .mockResolvedValueOnce({ error: 'User rejected request' })
      .mockResolvedValueOnce({ address: 'GCONNECTEDAFTERPROMPT' });
    getNetworkDetailsMock.mockResolvedValue({
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.error).toContain('rejected'));
    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');

    act(() => {
      result.current.connect();
    });

    await waitFor(() => expect(result.current.connected).toBe(true));

    expect(result.current.address).toBe('GCONNECTEDAFTERPROMPT');
    expect(result.current.error).toBeNull();
    expect(getAddressMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the hook disconnected when Freighter returns an error result', async () => {
    getAddressMock.mockResolvedValue({ error: 'Freighter is locked' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.error).toContain('Freighter'));

    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');
  });

  it('surfaces an install affordance when Freighter is unavailable', async () => {
    getAddressMock.mockRejectedValue(new Error('Freighter extension unavailable'));

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.error).toContain('Install it from freighter.app'));

    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');
  });

  it('reports a network mismatch without leaking the wallet address', async () => {
    const previousPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

    getAddressMock.mockResolvedValue({ address: 'G1234567890123456789012345678901234567890' });
    getNetworkDetailsMock.mockResolvedValue({ networkPassphrase: 'Wrong Network' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.error).toContain('wrong network'));

    expect(result.current.connected).toBe(true);
    expect(result.current.address).toBe('G1234567890123456789012345678901234567890');
    expect(result.current.error).not.toContain('G1234567890123456789012345678901234567890');

    if (previousPassphrase === undefined) {
      delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    } else {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = previousPassphrase;
    }
  });

  it('times out hung Freighter calls and clears state', async () => {
    vi.useFakeTimers();
    getAddressMock.mockImplementation(() => new Promise(() => undefined));

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000);
    });

    expect(result.current.error).toContain('timed out');
    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');

    vi.useRealTimers();
  });

  it('normalizes empty error messages to a generic Freighter fallback', async () => {
    getAddressMock.mockRejectedValue(new Error(''));

    const { result } = renderHook(() => useWallet());

    await waitFor(() =>
      expect(result.current.error).toBe('Unable to connect to Freighter. Please try again.'),
    );
    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');
  });

  it('normalizes network-related Freighter failures to a network guidance message', async () => {
    getAddressMock.mockRejectedValue(new Error('Network passphrase mismatch'));

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.error).toContain('wrong network'));
    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');
  });

  it('disconnect resets address, connected state, and errors', async () => {
    getAddressMock.mockResolvedValue({ address: 'GTORESET' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.connected).toBe(true));

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('leaves state idle when Freighter returns neither address nor error', async () => {
    getAddressMock.mockResolvedValue({});

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(getAddressMock).toHaveBeenCalledTimes(1));

    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');
    expect(result.current.error).toBeNull();
  });
});
