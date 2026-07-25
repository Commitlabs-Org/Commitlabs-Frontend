// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAddress, signMessage } from '@/lib/freighterAdapter';
import { useWallet } from '../useWallet';

vi.mock('@/lib/freighterAdapter', () => ({
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn().mockResolvedValue({ networkPassphrase: 'Test SDF Network ; September 2015' }),
  signMessage: vi.fn(),
  isConnected: vi.fn().mockResolvedValue(true),
  requestAccess: vi.fn(),
}));

const mockGetAddress = vi.mocked(getAddress);
const mockSignMessage = vi.mocked(signMessage);

function jsonResponse(ok: boolean, body: any): Response {
  return { ok, json: async () => body } as Response;
}

/**
 * Dispatches mocked fetch calls by URL instead of relying on call order,
 * since the hook now issues an automatic GET /api/auth/session check
 * whenever the connected address changes (not just during signIn/signOut).
 */
function createFetchMock(overrides: {
  session?: () => Response;
  nonce?: () => Response;
  verify?: () => Response;
  logout?: () => Response;
}) {
  return vi.fn(async (url: string) => {
    if (url === '/api/auth/session') {
      return (overrides.session ?? (() => jsonResponse(true, { authenticated: false })))();
    }
    if (url === '/api/auth/nonce') {
      return (overrides.nonce ?? (() => jsonResponse(false, {})))();
    }
    if (url === '/api/auth/verify') {
      return (overrides.verify ?? (() => jsonResponse(false, {})))();
    }
    if (url === '/api/auth/logout') {
      return (overrides.logout ?? (() => jsonResponse(true, {})))();
    }
    throw new Error(`Unhandled fetch to ${url}`);
  });
}

describe('useWallet authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAddress.mockReset();
    mockSignMessage.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.cookie = '';
    mockSignMessage.mockResolvedValue({ signedMessage: 'mock_signature' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('successful authentication flow (happy path)', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = createFetchMock({
      nonce: () =>
        jsonResponse(true, {
          success: true,
          data: { nonce: 'test_nonce', message: 'Sign in to CommitLabs: test_nonce' },
        }),
      verify: () =>
        jsonResponse(true, {
          success: true,
          data: { verified: true, address: 'GCONNECTED' },
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

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
    expect(result.current.authError).toBeNull();

    // The session lives exclusively in the server-set HttpOnly cookie.
    // The client must never write the token anywhere itself.
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it('handles user-rejected signature', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = createFetchMock({
      nonce: () => jsonResponse(true, { data: { nonce: 'n', message: 'msg' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    mockSignMessage.mockResolvedValueOnce({ error: 'User rejected signature' });

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.connected).toBe(true));

    let signInError: Error | null = null;
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
    expect(result.current.authError).toBe('User rejected signature');
  });

  it('handles nonce fetch failure', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = createFetchMock({
      nonce: () => jsonResponse(false, {}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.connected).toBe(true));

    let signInError: Error | null = null;
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
    expect(result.current.authError).toBe('Failed to fetch authentication nonce.');
  });

  it('handles signature verification failure', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = createFetchMock({
      nonce: () => jsonResponse(true, { data: { nonce: 'n', message: 'msg' } }),
      verify: () =>
        jsonResponse(false, { error: { message: 'Invalid signature supplied' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    mockSignMessage.mockResolvedValueOnce({ signedMessage: 'sig' });

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.connected).toBe(true));

    let signInError: Error | null = null;
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
    expect(result.current.authError).toBe('Invalid signature supplied');
  });

  it('re-fetches the address when signIn starts without a connected wallet', async () => {
    mockGetAddress
      .mockResolvedValueOnce({ error: 'User rejected request' })
      .mockResolvedValueOnce({ address: 'GCONNECTED' });

    const mockFetch = createFetchMock({
      nonce: () => jsonResponse(true, { data: { nonce: 'n', message: 'msg' } }),
      verify: () => jsonResponse(true, { data: { verified: true, address: 'GCONNECTED' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.error).toContain('rejected'));

    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.authenticated).toBe(true);
    expect(result.current.address).toBe('GCONNECTED');
  });

  it('reports missing nonce challenge messages', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = createFetchMock({
      nonce: () => jsonResponse(true, { data: { nonce: 'n' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    mockSignMessage.mockResolvedValueOnce(undefined as unknown as { signedMessage: string });

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
    expect(signInError.message).toContain('challenge');
  });

  it('surfaces a generic fallback error for unknown Freighter failures', async () => {
    mockGetAddress.mockRejectedValue(new Error('mystery wallet failure'));
    vi.stubGlobal('fetch', createFetchMock({}));

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.error).toBe('Unable to connect to Freighter. Please try again.'));
    expect(result.current.connected).toBe(false);
  });

  it('reports getAddress errors during signIn as authentication errors', async () => {
    mockGetAddress.mockResolvedValue({ error: 'Freighter is locked' });
    vi.stubGlobal('fetch', createFetchMock({}));

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.error).toContain('Freighter'));

    let signInError: any = null;
    await act(async () => {
      try {
        await result.current.signIn();
      } catch (err) {
        signInError = err;
      }
    });

    expect(signInError).not.toBeNull();
    expect(signInError.message).toContain('Freighter');
    expect(result.current.authError).toContain('Freighter');
  });

  it('reports missing wallet addresses during signIn', async () => {
    mockGetAddress.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    vi.stubGlobal('fetch', createFetchMock({}));

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(getAddress).toHaveBeenCalled());

    let signInError: any = null;
    await act(async () => {
      try {
        await result.current.signIn();
      } catch (err) {
        signInError = err;
      }
    });

    expect(signInError).not.toBeNull();
    expect(signInError.message).toContain('Unable to retrieve address');
  });

  it('reports missing signature responses from Freighter', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = createFetchMock({
      nonce: () => jsonResponse(true, { data: { nonce: 'n', message: 'msg' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    mockSignMessage.mockResolvedValueOnce(undefined as unknown as { signedMessage: string });

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
    expect(signInError.message).toContain('No response received');
  });

  it('reports missing signedMessage payloads during signIn', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = createFetchMock({
      nonce: () => jsonResponse(true, { data: { nonce: 'n', message: 'msg' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    mockSignMessage.mockResolvedValueOnce({} as { signedMessage: string });

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
    expect(signInError.message).toContain('rejected');
  });

  it('treats a verify response with verified: false as a failed handshake', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = createFetchMock({
      nonce: () => jsonResponse(true, { data: { nonce: 'n', message: 'msg' } }),
      verify: () => jsonResponse(true, { data: { verified: false } }),
    });
    vi.stubGlobal('fetch', mockFetch);

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
    expect(signInError.message).toContain('Verification failed');
    expect(result.current.authenticated).toBe(false);
  });

  it('successful sign-out clears authenticated state', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    const mockFetch = createFetchMock({
      session: () => jsonResponse(true, { authenticated: true, address: 'GCONNECTED' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.authenticated).toBe(true));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.authenticated).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });

    // No client-visible token anywhere to clean up.
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it('automatic sign-out on address mismatch or disconnect (account-switching safety)', async () => {
    mockGetAddress.mockResolvedValueOnce({ address: 'GCONNECTED_1' });

    const mockFetch = createFetchMock({
      session: () => jsonResponse(true, { authenticated: true, address: 'GCONNECTED_1' }),
    });
    vi.stubGlobal('fetch', mockFetch);

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

    // The session for GCONNECTED_1 no longer matches the wallet's reported
    // address, so the hook must have called logout to drop it.
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });

  it('prevent parallel signIn calls if already authenticating', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GCONNECTED' });

    let resolveNonce: (value: Response) => void;
    const noncePromise = new Promise<Response>((resolve) => {
      resolveNonce = resolve;
    });

    const mockFetch = createFetchMock({
      nonce: () => noncePromise,
      verify: () => jsonResponse(true, { data: { verified: true, address: 'GCONNECTED' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.connected).toBe(true));

    const nonceCallsBefore = mockFetch.mock.calls.filter((c) => c[0] === '/api/auth/nonce').length;

    let signInPromise1: Promise<void>;
    act(() => {
      signInPromise1 = result.current.signIn();
    });

    expect(result.current.authenticating).toBe(true);

    let signInPromise2: Promise<void>;
    act(() => {
      signInPromise2 = result.current.signIn();
    });

    resolveNonce!(jsonResponse(true, { data: { nonce: 'n', message: 'msg' } }));

    await act(async () => {
      await Promise.all([signInPromise1, signInPromise2]);
    });

    const nonceCallsAfter = mockFetch.mock.calls.filter((c) => c[0] === '/api/auth/nonce').length;
    expect(nonceCallsAfter - nonceCallsBefore).toBe(1);
  });
});
