// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { getAddress } from '@stellar/freighter-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from '../useWallet';

vi.mock('@stellar/freighter-api', () => ({
  getAddress: vi.fn(),
}));

const mockedGetAddress = vi.mocked(getAddress);

describe('useWallet', () => {
  beforeEach(() => {
    mockedGetAddress.mockReset();
  });

  it('auto-detects an already connected Freighter wallet on mount', async () => {
    mockedGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
      expect(result.current.address).toBe('GCONNECTED');
      expect(result.current.error).toBeNull();
    });
    expect(mockedGetAddress).toHaveBeenCalledTimes(1);
  });

  it('connects and stores the returned address', async () => {
    mockedGetAddress
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ address: 'GCONNECT' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(mockedGetAddress).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
      expect(result.current.address).toBe('GCONNECT');
      expect(result.current.error).toBeNull();
    });
    expect(mockedGetAddress).toHaveBeenCalledTimes(2);
  });

  it('disconnects and clears wallet state', async () => {
    mockedGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.connected).toBe(true));

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('stores Freighter error responses and clears connection state', async () => {
    mockedGetAddress.mockResolvedValue({ error: 'User rejected request' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => {
      expect(result.current.connected).toBe(false);
      expect(result.current.address).toBe('');
      expect(result.current.error).toBe('User rejected request');
    });
  });

  it('stores thrown Freighter errors and clears connection state', async () => {
    mockedGetAddress.mockRejectedValue(new Error('Freighter unavailable'));

    const { result } = renderHook(() => useWallet());

    await waitFor(() => {
      expect(result.current.connected).toBe(false);
      expect(result.current.address).toBe('');
      expect(result.current.error).toBe('Freighter unavailable');
    });
  });

  it('stays disconnected when Freighter returns no address and no error', async () => {
    mockedGetAddress.mockResolvedValue({});

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(mockedGetAddress).toHaveBeenCalledTimes(1));

    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('handles repeated connect calls with the latest Freighter address', async () => {
    mockedGetAddress
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ address: 'GFIRST' })
      .mockResolvedValueOnce({ address: 'GSECOND' });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(mockedGetAddress).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.connect();
    });
    await waitFor(() => expect(result.current.address).toBe('GFIRST'));

    act(() => {
      result.current.connect();
    });
    await waitFor(() => expect(result.current.address).toBe('GSECOND'));

    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockedGetAddress).toHaveBeenCalledTimes(3);
  });
});
