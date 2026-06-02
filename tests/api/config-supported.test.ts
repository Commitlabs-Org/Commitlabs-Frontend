import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/config/supported/route';
import { POST } from '@/app/api/commitments/route';
import { createMockRequest, parseResponse } from './helpers';
import { getSupportedConfig } from '@/lib/backend/config';

describe('GET /api/config/supported', () => {
  it('should return 200 with supported config data', async () => {
    const request = createMockRequest('http://localhost:3000/api/config/supported');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.data).toHaveProperty('assets');
    expect(result.data.data).toHaveProperty('riskProfiles');
    expect(result.data.data).toHaveProperty('bounds');

    // Bounds consistency check
    const bounds = result.data.data.bounds;
    expect(bounds.durationDays.min).toBeLessThanOrEqual(bounds.durationDays.max);
    expect(bounds.amount.min).toBeLessThanOrEqual(bounds.amount.max);
    expect(bounds.durationDays.min).toBe(1);
    expect(bounds.durationDays.max).toBe(365);
    expect(bounds.amount.min).toBeGreaterThan(0);
  });

  it('should match the source of truth config module', async () => {
    const request = createMockRequest('http://localhost:3000/api/config/supported');
    const response = await GET(request);
    const result = await parseResponse(response);

    const expectedConfig = getSupportedConfig();
    expect(result.data.data).toEqual(expectedConfig);
  });

  it('should include XLM in supported assets', async () => {
    const request = createMockRequest('http://localhost:3000/api/config/supported');
    const response = await GET(request);
    const result = await parseResponse(response);

    const assets = result.data.data.assets;
    const xlm = assets.find((a: any) => a.code === 'XLM');
    expect(xlm).toBeDefined();
    expect(xlm.name).toBe('Stellar Lumens');
    expect(xlm.decimals).toBe(7);
  });

  it('should include USDC in supported assets', async () => {
    const request = createMockRequest('http://localhost:3000/api/config/supported');
    const response = await GET(request);
    const result = await parseResponse(response);

    const assets = result.data.data.assets;
    const usdc = assets.find((a: any) => a.code === 'USDC');
    expect(usdc).toBeDefined();
    expect(usdc.name).toBe('USD Coin');
    expect(usdc.decimals).toBe(7);
  });
});

describe('POST /api/commitments - Asset Allowlist Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject unsupported asset with VALIDATION_ERROR', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNQB37HNU7F5V4ZDBEFVPEB6',
        asset: 'INVALID_ASSET',
        amount: '100',
        durationDays: 30,
        maxLossBps: 1000,
      },
    });

    const response = await POST(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
    expect(result.data.error.message).toContain('not supported');
  });

  it('should accept XLM asset', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNQB37HNU7F5V4ZDBEFVPEB6',
        asset: 'XLM',
        amount: '100',
        durationDays: 30,
        maxLossBps: 1000,
      },
    });

    const response = await POST(request);
    const result = await parseResponse(response);

    // Should not fail on asset validation (may fail on other reasons like rate limit or chain call)
    if (result.status === 400) {
      expect(result.data.error.code).not.toBe('VALIDATION_ERROR');
    }
  });

  it('should accept USDC asset', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNQB37HNU7F5V4ZDBEFVPEB6',
        asset: 'USDC',
        amount: '100',
        durationDays: 30,
        maxLossBps: 1000,
      },
    });

    const response = await POST(request);
    const result = await parseResponse(response);

    // Should not fail on asset validation (may fail on other reasons like rate limit or chain call)
    if (result.status === 400) {
      expect(result.data.error.code).not.toBe('VALIDATION_ERROR');
    }
  });

  it('should be case-insensitive for asset codes', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNQB37HNU7F5V4ZDBEFVPEB6',
        asset: 'xlm',
        amount: '100',
        durationDays: 30,
        maxLossBps: 1000,
      },
    });

    const response = await POST(request);
    const result = await parseResponse(response);

    // Should not fail on asset validation (may fail on other reasons like rate limit or chain call)
    if (result.status === 400) {
      expect(result.data.error.code).not.toBe('VALIDATION_ERROR');
    }
  });

  it('should reject empty asset string', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNQB37HNU7F5V4ZDBEFVPEB6',
        asset: '',
        amount: '100',
        durationDays: 30,
        maxLossBps: 1000,
      },
    });

    const response = await POST(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it('should reject null asset', async () => {
    const request = createMockRequest('http://localhost:3000/api/commitments', {
      method: 'POST',
      body: {
        ownerAddress: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNQB37HNU7F5V4ZDBEFVPEB6',
        asset: null,
        amount: '100',
        durationDays: 30,
        maxLossBps: 1000,
      },
    });

    const response = await POST(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });
});
