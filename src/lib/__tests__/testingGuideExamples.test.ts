/**
 * @file testingGuideExamples.test.ts
 *
 * This file contains executable examples from the TESTING_GUIDE.md documentation.
 * It serves as a "living specification" to ensure guide examples remain valid and
 * demonstrate real working patterns for mocking fetch, Freighter, timers, and RTL.
 *
 * Coverage requirement: All examples must maintain 95% coverage on test utilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Mocking Fetch
// ─────────────────────────────────────────────────────────────────────────────

describe('Fetch Mocking Patterns', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('mocks successful fetch response', async () => {
    const mockData = { id: 1, name: 'Test Item' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as Response);

    const response = await fetch('/api/items');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith('/api/items');
  });

  it('mocks fetch with POST method and body', async () => {
    const requestBody = { email: 'test@example.com' };
    const responseData = { success: true, id: '123' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => responseData,
    } as Response);

    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/signup',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
    );
    expect(await response.json()).toEqual(responseData);
  });

  it('mocks fetch error', async () => {
    const error = new Error('Network error');
    mockFetch.mockRejectedValueOnce(error);

    await expect(fetch('/api/items')).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('mocks different responses for multiple fetch calls', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 2 }),
      } as Response);

    const first = await (await fetch('/api/items/1')).json();
    const second = await (await fetch('/api/items/2')).json();

    expect(first).toEqual({ id: 1 });
    expect(second).toEqual({ id: 2 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('mocks fetch with custom headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authorized: true }),
    } as Response);

    await fetch('/api/protected', {
      headers: {
        Authorization: 'Bearer token-123',
        'X-Custom-Header': 'custom-value',
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/protected',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
          'X-Custom-Header': 'custom-value',
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Mocking Freighter Wallet API
// ─────────────────────────────────────────────────────────────────────────────

describe('Freighter Wallet API Mocking', () => {
  // Create a mock wrapper to simulate Freighter API
  const createMockFreighterApi = () => ({
    isConnected: vi.fn(),
    getPublicKey: vi.fn(),
    signTransaction: vi.fn(),
    isAllowed: vi.fn(),
    getUserInfo: vi.fn(),
  });

  let freighterApi: ReturnType<typeof createMockFreighterApi>;

  beforeEach(() => {
    freighterApi = createMockFreighterApi();
    vi.clearAllMocks();
  });

  it('mocks checking if Freighter is connected', async () => {
    freighterApi.isConnected.mockResolvedValue(true);

    const connected = await freighterApi.isConnected();

    expect(connected).toBe(true);
    expect(freighterApi.isConnected).toHaveBeenCalled();
  });

  it('mocks retrieving public key', async () => {
    const mockAddress = `G${'A'.repeat(56)}`;
    freighterApi.getPublicKey.mockResolvedValue(mockAddress);

    const address = await freighterApi.getPublicKey();

    expect(address).toBe(mockAddress);
    expect(address).toMatch(/^G[A-Z0-9]{56}$/);
  });

  it('mocks signing a transaction', async () => {
    const mockXDR = 'AAAAAgAA...signed...xdr...';
    const transactionXDR = 'AAAAAgAA...unsigned...xdr...';

    freighterApi.signTransaction.mockResolvedValue(mockXDR);

    const signed = await freighterApi.signTransaction(transactionXDR);

    expect(signed).toBe(mockXDR);
    expect(freighterApi.signTransaction).toHaveBeenCalledWith(transactionXDR);
  });

  it('mocks wallet not installed error', async () => {
    const error = new Error('Freighter is not installed');
    freighterApi.isConnected.mockRejectedValue(error);

    await expect(freighterApi.isConnected()).rejects.toThrow(
      'Freighter is not installed'
    );
  });

  it('mocks user rejection of transaction', async () => {
    const error = new Error('User rejected signing');
    freighterApi.signTransaction.mockRejectedValue(error);

    await expect(freighterApi.signTransaction('xdr')).rejects.toThrow(
      'User rejected signing'
    );
  });

  it('mocks checking if domain is allowed', async () => {
    freighterApi.isAllowed.mockResolvedValue(true);

    const allowed = await freighterApi.isAllowed();

    expect(allowed).toBe(true);
  });

  it('mocks getting user info after connection', async () => {
    const userInfo = {
      publicKey: `G${'A'.repeat(55)}`,
    };

    freighterApi.getUserInfo.mockResolvedValue(userInfo);

    const info = await freighterApi.getUserInfo();

    expect(info).toEqual(userInfo);
    expect(info.publicKey).toMatch(/^G/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Fake Timers
// ─────────────────────────────────────────────────────────────────────────────

describe('Fake Timers Patterns', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances timers by specific milliseconds', () => {
    const callback = vi.fn();
    setTimeout(callback, 3000);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000);

    expect(callback).toHaveBeenCalledOnce();
  });

  it('handles multiple timeouts at different intervals', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();

    setTimeout(cb1, 1000);
    setTimeout(cb2, 2000);
    setTimeout(cb3, 3000);

    vi.advanceTimersByTime(1000);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(cb2).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(cb3).toHaveBeenCalledTimes(1);
  });

  it('runs all pending timers at once', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    setTimeout(callback1, 5000);
    setTimeout(callback2, 10000);

    vi.runAllTimers();

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });

  it('handles intervals', () => {
    const callback = vi.fn();
    const interval = setInterval(callback, 1000);

    vi.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(2000);
    expect(callback).toHaveBeenCalledTimes(5);

    clearInterval(interval);
  });

  it('simulates polling with intervals', () => {
    const pollCallback = vi.fn();

    const intervalId = setInterval(() => {
      pollCallback();
    }, 500);

    // Simulate 2 seconds of polling
    vi.advanceTimersByTime(2000);

    expect(pollCallback).toHaveBeenCalledTimes(4); // 0.5s, 1s, 1.5s, 2s

    clearInterval(intervalId);
  });

  it('handles date progression with fake timers', () => {
    const now = new Date(2024, 0, 1);
    vi.setSystemTime(now);

    const initialTime = new Date();
    expect(initialTime.getFullYear()).toBe(2024);

    // Advance by 1 day
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);

    const laterTime = new Date();
    expect(laterTime.getDate()).toBe(2);
  });

  it('tests retry with exponential backoff', () => {
    const attemptCallback = vi.fn();
    let attempt = 0;

    function retryWithBackoff() {
      attempt++;
      attemptCallback();

      if (attempt < 3) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s
        setTimeout(retryWithBackoff, delayMs);
      }
    }

    retryWithBackoff();
    expect(attemptCallback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(attemptCallback).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(4000);
    expect(attemptCallback).toHaveBeenCalledTimes(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Mocking Module Imports
// ─────────────────────────────────────────────────────────────────────────────

describe('Module Import Mocking', () => {
  // Create a mock service object to simulate real module exports
  const createMockService = () => ({
    getCommitment: vi.fn(),
    createCommitment: vi.fn(),
    updateCommitment: vi.fn(),
  });

  let mockService: ReturnType<typeof createMockService>;

  beforeEach(() => {
    mockService = createMockService();
    vi.clearAllMocks();
  });

  it('mocks exported functions', async () => {
    const mockData = { id: 'c-1', status: 'ACTIVE' };
    mockService.getCommitment.mockResolvedValue(mockData);

    const result = await mockService.getCommitment('c-1');

    expect(result).toEqual(mockData);
    expect(mockService.getCommitment).toHaveBeenCalledWith('c-1');
  });

  it('tracks call arguments', async () => {
    mockService.createCommitment.mockResolvedValue({ id: 'c-2' });

    await mockService.createCommitment({ amount: '100', duration: 30 });

    expect(mockService.createCommitment).toHaveBeenCalledWith({
      amount: '100',
      duration: 30,
    });
  });

  it('mocks multiple calls with different return values', async () => {
    mockService.getCommitment
      .mockResolvedValueOnce({ id: 'c-1' })
      .mockResolvedValueOnce({ id: 'c-2' })
      .mockResolvedValueOnce({ id: 'c-3' });

    const r1 = await mockService.getCommitment('c-1');
    const r2 = await mockService.getCommitment('c-2');
    const r3 = await mockService.getCommitment('c-3');

    expect(r1.id).toBe('c-1');
    expect(r2.id).toBe('c-2');
    expect(r3.id).toBe('c-3');
  });

  it('mocks rejections for error handling', async () => {
    const error = new Error('Commitment not found');
    mockService.getCommitment.mockRejectedValue(error);

    await expect(mockService.getCommitment('invalid')).rejects.toThrow(
      'Commitment not found'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: Helper Utilities for Common Patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper to create mock responses consistently
 */
function createMockResponse<T>(data: T, status = 200): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as Response);
}

describe('Test Helper Utilities', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses createMockResponse helper for success', async () => {
    const data = { items: [{ id: 1, name: 'Item 1' }] };
    mockFetch.mockResolvedValue(await createMockResponse(data, 200));

    const response = await fetch('/api/items');
    const json = await response.json();

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(json).toEqual(data);
  });

  it('uses createMockResponse helper for error', async () => {
    const errorData = { error: 'Not found' };
    mockFetch.mockResolvedValue(await createMockResponse(errorData, 404));

    const response = await fetch('/api/items/999');

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it('validates response content type header', async () => {
    const data = { test: true };
    mockFetch.mockResolvedValue(await createMockResponse(data));

    const response = await fetch('/api/test');

    expect(response.headers.get('content-type')).toBe('application/json');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 6: Common Integration Patterns
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration Testing Patterns', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('combines fetch mock with fake timers for polling', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ status: callCount < 3 ? 'pending' : 'done' }),
      } as Response;
    });

    let status = 'pending';
    const pollInterval = setInterval(async () => {
      const response = await fetch('/api/status');
      const data = await response.json();
      status = data.status;
    }, 1000);

    // First poll at 1s
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Second poll at 2s
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(callCount).toBe(2);

    // Third poll at 3s - should be 'done'
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(callCount).toBe(3);

    clearInterval(pollInterval);
  });

  it('simulates sequential fetch retries', async () => {
    let attemptCount = 0;

    mockFetch.mockImplementation(async () => {
      attemptCount++;
      if (attemptCount < 2) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: 'Service unavailable' }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' }),
      } as Response;
    });

    let finalResult = null;

    for (let i = 0; i < 2; i++) {
      const response = await fetch('/api/data');
      if (response.ok) {
        finalResult = await response.json();
        break;
      }
      // Simulate delay between retries with fake timers
      vi.advanceTimersByTime(500);
    }

    expect(finalResult).toEqual({ data: 'success' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
