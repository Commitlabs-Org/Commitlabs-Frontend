import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchXlmBalance } from './wallet';

describe('wallet.ts - fetchXlmBalance', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps 404 to unfunded status with friendbot link', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        type: 'https://stellar.org/horizon-errors/not_found',
        title: 'Resource Missing',
        status: 404,
      }),
    });

    const testAddress = 'GAEXAMPLE1234567890';
    const res = await fetchXlmBalance(testAddress);

    expect(res.status).toBe('unfunded');
    if (res.status === 'unfunded') {
      expect(res.message).toBe('Account not funded on testnet');
      expect(res.friendbotUrl).toContain('friendbot');
      expect(res.friendbotUrl).toContain(encodeURIComponent(testAddress));
    }
  });

  it('maps network error to error status with retry capability', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to connect to Horizon'));

    const res = await fetchXlmBalance('GAEXAMPLE1234567890');

    expect(res.status).toBe('error');
    if (res.status === 'error') {
      expect(res.kind).toBe('network');
      expect(res.canRetry).toBe(true);
      expect(res.message).toContain("Couldn't load balance");
    }
  });

  it('maps HTTP server error (500) to error status with retry capability', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Horizon server error' }),
    });

    const res = await fetchXlmBalance('GAEXAMPLE1234567890');

    expect(res.status).toBe('error');
    if (res.status === 'error') {
      expect(res.kind).toBe('http');
      expect(res.canRetry).toBe(true);
    }
  });

  it('returns native XLM balance on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        balances: [
          { asset_type: 'credit_alphanum4', balance: '500.00' },
          { asset_type: 'native', balance: '1234.56789' },
        ],
      }),
    });

    const res = await fetchXlmBalance('GAEXAMPLE1234567890');

    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect(res.balance).toBe('1234.56789');
    }
  });

  it('aborts when external signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const res = await fetchXlmBalance('GAEXAMPLE1234567890', {
      signal: controller.signal,
    });

    expect(res.status).toBe('error');
  });
});
