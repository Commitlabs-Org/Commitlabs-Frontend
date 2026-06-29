// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAddress, signMessage } from '@stellar/freighter-api';
import { useWallet } from '../useWallet';

vi.mock('@stellar/freighter-api', () => ({
  getAddress: vi.fn(),
  signMessage: vi.fn(),
}));

const mockGetAddress = vi.mocked(getAddress);
const mockSignMessage = vi.mocked(signMessage);

describe('useWallet authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    window.localStorage.clear();
    window.sessionStorage.clear();
    // Clear cookies cleanly
    document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Default mock response to avoid unhandled TypeErrors in the background
    mockSignMessage.mockResolvedValue({ signedMessage: 'mock_signature' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('successful authentication flow (happy path)', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          nonce: 'test_nonce',
          message: 'Sign in to CommitLabs: test_nonce',
        },
      }),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          verified: true,
          sessionToken: 'session_mockToken_123',
        },
      }),
    } as Response);

    mockSignMessage.mockResolvedValueOnce({
      signedMessage: 'mock_signature',
    });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.connected).toBe(true));
    expect(result.current.address).toBe('GCONNECTED');

    let signInPromise: Promise<void>;
    act(() => {
      signInPromise = result.current.signIn();
    });

    expect(result.current.authenticating).toBe(true);

    await act(async () => {
      await signInPromise;
    });

    expect(result.current.authenticating).toBe(false);
    expect(result.current.authenticated).toBe(true);
    expect(result.current.sessionToken).toBe('session_mockToken_123');
    expect(result.current.authError).toBeNull();

    expect(window.localStorage.getItem('sessionToken')).toBe('session_mockToken_123');
    expect(window.localStorage.getItem('commitlabs.authAddress')).toBe('GCONNECTED');
    expect(document.cookie).toContain('session=session_mockToken_123');
  });

  it('handles user-rejected signature', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { nonce: 'n', message: 'msg' },
      }),
    } as Response);

    mockSignMessage.mockResolvedValueOnce({
      error: 'User rejected signature',
    });

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.connected).toBe(true));

    let signInError: any = null;
    await act(async () => {
      try {
        await result.current.signIn();
      } catch (err) {
        signInError = err;
      }
    });

    expect(signInError).not.toBeNull();
    expect(signInError.message).toBe('User rejected signature');

    expect(result.current.authenticated).toBe(false);
    expect(result.current.sessionToken).toBeNull();
    expect(result.current.authError).toBe('User rejected signature');
  });

  it('handles nonce fetch failure', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
    } as Response);

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.connected).toBe(true));

    let signInError: any = null;
    await act(async () => {
      try {
        await result.current.signIn();
      } catch (err) {
        signInError = err;
      }
    });

    expect(signInError).not.toBeNull();
    expect(signInError.message).toBe('Failed to fetch authentication nonce.');

    expect(result.current.authenticated).toBe(false);
    expect(result.current.sessionToken).toBeNull();
    expect(result.current.authError).toBe('Failed to fetch authentication nonce.');
  });

  it('handles signature verification failure', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { nonce: 'n', message: 'msg' },
      }),
    } as Response);

    mockSignMessage.mockResolvedValueOnce({
      signedMessage: 'sig',
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: 'Invalid signature supplied' },
      }),
    } as Response);

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.connected).toBe(true));

    let signInError: any = null;
    await act(async () => {
      try {
        await result.current.signIn();
      } catch (err) {
        signInError = err;
      }
    });

    expect(signInError).not.toBeNull();
    expect(signInError.message).toBe('Invalid signature supplied');

    expect(result.current.authenticated).toBe(false);
    expect(result.current.sessionToken).toBeNull();
    expect(result.current.authError).toBe('Invalid signature supplied');
  });

  it('successful sign-out clears storage, cookies, and state', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    window.localStorage.setItem('sessionToken', 'session_active_123');
    window.localStorage.setItem('commitlabs.authAddress', 'GCONNECTED');
    document.cookie = 'session=session_active_123';

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
    } as Response);

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.sessionToken).toBe('session_active_123'));
    expect(result.current.authenticated).toBe(true);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.authenticated).toBe(false);
    expect(result.current.sessionToken).toBeNull();
    expect(window.localStorage.getItem('sessionToken')).toBeNull();
    expect(document.cookie).not.toContain('session=session_active_123');
  });

  it('automatic sign-out on address mismatch or disconnect (account-switching safety)', async () => {
    mockGetAddress.mockResolvedValueOnce({ address: 'GCONNECTED_1' });
    window.localStorage.setItem('sessionToken', 'session_active_123');
    window.localStorage.setItem('commitlabs.authAddress', 'GCONNECTED_1');
    document.cookie = 'session=session_active_123';

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.connected).toBe(true));
    await waitFor(() => expect(result.current.authenticated).toBe(true));
    expect(result.current.address).toBe('GCONNECTED_1');

    mockGetAddress.mockResolvedValueOnce({ address: 'GCONNECTED_2' });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => expect(result.current.address).toBe('GCONNECTED_2'));
    await waitFor(() => expect(result.current.authenticated).toBe(false));
    expect(result.current.sessionToken).toBeNull();
    expect(window.localStorage.getItem('sessionToken')).toBeNull();
  });

  it('prevent parallel signIn calls if already authenticating', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => new Promise(resolve => setTimeout(() => resolve({
        data: { nonce: 'n', message: 'msg' },
      }), 50)),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { verified: true, sessionToken: 'token' },
      }),
    } as Response);

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.connected).toBe(true));

    let signInPromise1: Promise<void>;
    act(() => {
      signInPromise1 = result.current.signIn();
    });

    expect(result.current.authenticating).toBe(true);

    let signInPromise2: Promise<void>;
    act(() => {
      signInPromise2 = result.current.signIn();
    });

    await act(async () => {
      await Promise.all([signInPromise1, signInPromise2]);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
