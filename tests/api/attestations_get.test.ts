import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/attestations/route';

vi.mock('@/lib/backend/mockDb', () => ({
  getMockData: vi.fn(async () => ({
    attestations: Array.from({ length: 25 }, (_, i) => ({
      id: `att-${i}`,
      commitmentId: i < 5 ? 'comm-1' : 'comm-2',
      type: 'health_check',
    })),
  })),
}));

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => true),
}));

describe('GET /api/attestations', () => {
  const baseUrl = 'http://localhost/api/attestations';

  it('should filter results by commitmentId', async () => {
    const req = new NextRequest(`${baseUrl}?commitmentId=comm-1`);
    const res = await GET(req);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(5);
    expect(body.data.meta.totalItems).toBe(5);
    body.data.items.forEach((item: any) => {
      expect(item.commitmentId).toBe('comm-1');
    });
  });

  it('should return the correct subset for page 2', async () => {
    const req = new NextRequest(`${baseUrl}?page=2&pageSize=10`);
    const res = await GET(req);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(10);
    expect(body.data.meta.currentPage).toBe(2);
    // Offset for page 2, size 10 should start from index 10 (id att-10)
    expect(body.data.items[0].id).toBe('att-10');
  });

  it('should handle out-of-bounds page requests gracefully', async () => {
    const req = new NextRequest(`${baseUrl}?page=100`);
    const res = await GET(req);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(0);
    expect(body.data.meta.currentPage).toBe(100);
    expect(body.data.meta.totalPages).toBe(3); // 25 items / 10 per page = 3 pages
  });

  it('should include the standardized response envelope', async () => {
    const req = new NextRequest(baseUrl);
    const res = await GET(req);
    const body = await res.json();

    expect(body).toHaveProperty('ok');
    expect(body).toHaveProperty('data');
  });
});