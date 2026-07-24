// @vitest-environment happy-dom

import { getAddress } from '@stellar/freighter-api';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWallet } from '../useWallet';

vi.mock('@stellar/freighter-api', () => ({
  getAddress: vi.fn(),
}));

const getAddressMock = vi.mocked(getAddress);

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

  it('connect populates address and clears a prior Freighter error', async () => {
    getAddressMock
      .mockResolvedValueOnce({ error: 'User rejected request' })
      .mockResolvedValueOnce({ address: 'GCONNECTEDAFTERPROMPT' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.error).toBe('User rejected request'));
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

    await waitFor(() => expect(result.current.error).toBe('Freighter is locked'));

    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');
  });

  it('captures thrown Freighter exceptions as hook errors', async () => {
    getAddressMock.mockRejectedValue(new Error('Freighter extension unavailable'));

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.error).toBe('Freighter extension unavailable'));

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
