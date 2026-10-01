import { describe, expect, it } from 'vitest';
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers';

interface TestPayload {
  name: string;
  count: number;
}

describe('tests/api/helpers', () => {
  describe('createMockRequest', () => {
    it('creates a NextRequest with default GET method and JSON headers', () => {
      const req = createMockRequest('http://localhost:3000/api/test');
      expect(req.method).toBe('GET');
      expect(req.headers.get('content-type')).toBe('application/json');
    });

    it('creates a NextRequest with custom method and custom headers', () => {
      const req = createMockRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'x-custom-header': 'test-val' },
      });
      expect(req.method).toBe('POST');
      expect(req.headers.get('x-custom-header')).toBe('test-val');
      expect(req.headers.get('content-type')).toBe('application/json');
    });

    it('serializes request body to JSON when body is provided', async () => {
      const body: TestPayload = { name: 'sample', count: 42 };
      const req = createMockRequest<TestPayload>('http://localhost:3000/api/test', {
        method: 'POST',
        body,
      });
      const parsedBody = await req.json();
      expect(parsedBody).toEqual(body);
    });
  });

  describe('createMockRouteContext', () => {
    it('returns empty params object by default', () => {
      const context = createMockRouteContext();
      expect(context).toEqual({ params: {} });
    });

    it('returns passed route parameters', () => {
      const context = createMockRouteContext({ id: 'cm_123' });
      expect(context).toEqual({ params: { id: 'cm_123' } });
    });
  });

  describe('parseResponse', () => {
    it('parses JSON response correctly', async () => {
      const jsonResponse = new Response(JSON.stringify({ success: true, count: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await parseResponse(jsonResponse);
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ success: true, count: 1 });
    });

    it('parses text response when content-type is not JSON', async () => {
      const textResponse = new Response('plain text response', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      });
      const result = await parseResponse(textResponse);
      expect(result.status).toBe(400);
      expect(result.data).toBe('plain text response');
    });
  });
});
