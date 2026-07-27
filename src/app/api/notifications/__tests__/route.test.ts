import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/notifications pagination', () => {
  it('should return 400 for non-numeric page', async () => {
    const req = new NextRequest('http://localhost/api/notifications?page=abc');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 for non-numeric pageSize', async () => {
    const req = new NextRequest('http://localhost/api/notifications?pageSize=abc');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should work with valid numeric parameters', async () => {
    const req = new NextRequest('http://localhost/api/notifications?page=1&pageSize=5');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.length).toBe(5);
  });
});
