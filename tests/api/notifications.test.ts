import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/notifications/route';
import { createMockRequest, parseResponse } from './helpers';
import * as mockDb from '@/lib/backend/mockDb';
import { jsonFilePreferencesStore } from '@/lib/backend/preferences';

vi.mock('@/lib/backend/mockDb', () => ({
  getMockData: vi.fn(),
}));

// Keep the real (pure) category-filter helpers so the route's actual
// filtering logic is exercised; replace only the disk-backed store so
// tests stay hermetic.
vi.mock('@/lib/backend/preferences', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/backend/preferences')>();
  return {
    ...actual,
    jsonFilePreferencesStore: {
      get: vi.fn(),
      upsert: vi.fn(),
    },
  };
});

const prefsGet = jsonFilePreferencesStore.get as ReturnType<typeof vi.fn>;

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no stored preferences -> safe opt-in defaults (all categories).
    prefsGet.mockResolvedValue(null);
    (mockDb.getMockData as any).mockResolvedValue({
      commitments: [
        {
          id: 'CMT-1',
          ownerAddress: '0x123',
          asset: 'XLM',
          status: 'Active',
          daysRemaining: 5,
        },
        {
          id: 'CMT-2',
          ownerAddress: '0x123',
          asset: 'USDC',
          status: 'Violated',
          daysRemaining: 20,
        },
        {
          id: 'CMT-3',
          ownerAddress: '0x456', // Different owner
          asset: 'BTC',
          status: 'Active',
          daysRemaining: 3,
        },
      ],
      attestations: [
        {
          id: 'ATTR-1',
          commitmentId: 'CMT-1',
          severity: 'warning',
          observedAt: '2026-01-10T12:00:00Z',
        },
        {
          id: 'ATTR-2',
          commitmentId: 'CMT-2',
          verdict: 'fail',
          observedAt: '2026-01-11T12:00:00Z',
        },
      ],
      listings: [],
    });
  });

  it('should return 400 if ownerAddress is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/notifications');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
    expect(result.data.error.message).toContain('Missing ownerAddress');
  });

  it('should return notifications filtered by ownerAddress', async () => {
    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data).toHaveProperty('items');
    expect(result.data.data).toHaveProperty('total');

    // CMT-1 is nearing expiry (1), CMT-2 is violated (1)
    // CMT-1 has warning attestation (1), CMT-2 has failed attestation (1)
    // Total should be 4
    expect(result.data.data.total).toBe(4);
    expect(result.data.data.items.length).toBe(4);

    result.data.data.items.forEach((notification: any) => {
      expect(notification.ownerAddress).toBe('0x123');
      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('title');
      expect(notification).toHaveProperty('severity');
    });
  });

  it('should return empty list if owner has no commitments', async () => {
    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x999');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.total).toBe(0);
    expect(result.data.data.items.length).toBe(0);
  });

  it('should support pagination', async () => {
    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123&page=1&pageSize=2');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.page).toBe(1);
    expect(result.data.data.pageSize).toBe(2);
    expect(result.data.data.items.length).toBe(2);
    expect(result.data.data.total).toBe(4);
  });

  it('should return 400 for invalid pagination params', async () => {
    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123&page=0');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
  });

  // ─── Notification delivery preference enforcement ──────────────────────────

  it('delivers every category when no preferences are stored', async () => {
    prefsGet.mockResolvedValue(null);

    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.total).toBe(4);
    expect(prefsGet).toHaveBeenCalledWith('0x123');
  });

  it('delivers every category when notificationCategories is an empty object', async () => {
    prefsGet.mockResolvedValue({ notificationCategories: {} });

    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.total).toBe(4);
  });

  it('excludes notifications of an opted-out category and total reflects it', async () => {
    // 0x123 feed: 1 expiry, 2 violation, 1 health_check.
    prefsGet.mockResolvedValue({ notificationCategories: { violation: false } });

    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.total).toBe(2);
    expect(result.data.data.items.length).toBe(2);

    const types = result.data.data.items.map((n: any) => n.type);
    expect(types).not.toContain('violation');
    expect(types.sort()).toEqual(['expiry', 'health_check']);
  });

  it('applies preference filtering BEFORE pagination', async () => {
    // Opt out `expiry` -> feed shrinks from 4 to 3 [violation, violation, health_check].
    // With pageSize 2: page 1 = 2 violations, page 2 = 1 health_check.
    // If filtering ran after pagination, page 2 would still hold 2 items
    // and total would wrongly be 4.
    prefsGet.mockResolvedValue({ notificationCategories: { expiry: false } });

    const request = createMockRequest(
      'http://localhost:3000/api/notifications?ownerAddress=0x123&page=2&pageSize=2',
    );
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.total).toBe(3);
    expect(result.data.data.items.length).toBe(1);
    expect(result.data.data.items[0].type).toBe('health_check');
  });

  it('returns an empty feed when every category is opted out', async () => {
    prefsGet.mockResolvedValue({
      notificationCategories: { expiry: false, violation: false, health_check: false },
    });

    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data.data.total).toBe(0);
    expect(result.data.data.items).toEqual([]);
  });

  it('keeps the response envelope unchanged when filtering is applied', async () => {
    prefsGet.mockResolvedValue({ notificationCategories: { violation: false } });

    const request = createMockRequest('http://localhost:3000/api/notifications?ownerAddress=0x123');
    const response = await GET(request);
    const result = await parseResponse(response);

    expect(Object.keys(result.data.data).sort()).toEqual(
      ['items', 'page', 'pageSize', 'total'].sort(),
    );
  });
});