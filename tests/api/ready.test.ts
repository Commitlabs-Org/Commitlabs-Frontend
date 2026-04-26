import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRequest, parseResponse } from './helpers';

describe('GET /api/ready', () => {
  beforeEach(() => {
    vi.mock('@/lib/backend', () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }));
    // Clear global fetch before each test
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 200 when RPC is reachable', async () => {
    vi.stubEnv('NEXT_PUBLIC_SOROBAN_RPC_URL', 'https://rpc-reachable.example.com');
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: { status: 'healthy' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Dynamic import to pick up the env stub
    const { GET } = await import('@/app/api/ready/route');
    
    const response = await GET();
    const result = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(result.data.status).toBe('ready');
    expect(result.data.checks.sorobanRpc.reachable).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('https://rpc-reachable.example.com', expect.any(Object));
  });

  it('returns 503 when RPC responds with an error status', async () => {
    vi.stubEnv('NEXT_PUBLIC_SOROBAN_RPC_URL', 'https://rpc-error.example.com');
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal('fetch', mockFetch);

    const { GET } = await import('@/app/api/ready/route');
    
    const response = await GET();
    const result = await parseResponse(response);

    expect(response.status).toBe(503);
    expect(result.data.status).toBe('not_ready');
    expect(result.data.checks.sorobanRpc.reachable).toBe(false);
    expect(result.data.checks.sorobanRpc.error).toContain('HTTP 500');
  });

  it('returns 503 when RPC fetch throws an exception (timeout/network error)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SOROBAN_RPC_URL', 'https://rpc-timeout.example.com');
    
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection timed out'));
    vi.stubGlobal('fetch', mockFetch);

    const { GET } = await import('@/app/api/ready/route');
    
    const response = await GET();
    const result = await parseResponse(response);

    expect(response.status).toBe(503);
    expect(result.data.status).toBe('not_ready');
    expect(result.data.checks.sorobanRpc.reachable).toBe(false);
    expect(result.data.checks.sorobanRpc.error).toBe('Connection timed out');
  });

  it('returns 200 when RPC is not configured', async () => {
    // Explicitly unset the env var
    vi.stubEnv('NEXT_PUBLIC_SOROBAN_RPC_URL', '');
    
    const { GET } = await import('@/app/api/ready/route');
    
    const response = await GET();
    const result = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(result.data.status).toBe('ready');
    expect(result.data.checks.sorobanRpc.reachable).toBe(null);
    expect(result.data.checks.sorobanRpc.note).toBe('not configured');
    
    // Fetch should not be called
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
