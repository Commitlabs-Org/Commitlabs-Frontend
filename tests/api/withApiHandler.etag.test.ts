import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '../../src/lib/backend/withApiHandler';
import { generateETag } from '../../src/lib/backend/etag';

// Mock dependencies
vi.mock('../../src/lib/backend/apiResponse', () => ({
  getCorrelationId: () => 'test-correlation-id',
  fail: (code: string, message: string, details?: unknown, status?: number, retryAfter?: number, correlationId?: string) => {
    return new NextResponse(JSON.stringify({ code, message, details }), { status: status || 500 });
  },
}));

vi.mock('../../src/lib/backend/cors', () => ({
  applyCorsPolicy: (req: any, response: Response) => response,
  enforceCorsRequestPolicy: () => {},
}));

vi.mock('../../src/lib/backend/logger', () => ({
  logError: () => {},
  logWarn: () => {},
}));

describe('withApiHandler - ETag Integration', () => {
  describe('ETag generation and 304 handling', () => {
    it('should add ETag header to successful 200 responses', async () => {
      const testData = { id: 1, name: 'test' };
      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(200);
      expect(response.headers.has('ETag')).toBe(true);
      expect(response.headers.get('ETag')).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('should return 304 when If-None-Match matches current ETag', async () => {
      const testData = { id: 1, name: 'test' };
      const expectedETag = generateETag(testData);

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'If-None-Match': expectedETag },
      });

      const response = await handler(req, { params: {} });

      expect(response.status).toBe(304);
      expect(response.headers.get('ETag')).toBe(expectedETag);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
    });

    it('should return 200 with new data when If-None-Match does not match', async () => {
      const testData = { id: 1, name: 'test' };
      const oldETag = '"old-etag"';

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'If-None-Match': oldETag },
      });

      const response = await handler(req, { params: {} });

      expect(response.status).toBe(200);
      expect(response.headers.get('ETag')).not.toBe(oldETag);
      const body = await response.json();
      expect(body).toEqual(testData);
    });

    it('should handle multiple ETags in If-None-Match header', async () => {
      const testData = { id: 1, name: 'test' };
      const currentETag = generateETag(testData);
      const multipleETags = `"old-etag-1", ${currentETag}, "old-etag-2"`;

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'If-None-Match': multipleETags },
      });

      const response = await handler(req, { params: {} });

      expect(response.status).toBe(304);
      expect(response.headers.get('ETag')).toBe(currentETag);
    });

    it('should handle wildcard If-None-Match header', async () => {
      const testData = { id: 1, name: 'test' };

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'If-None-Match': '*' },
      });

      const response = await handler(req, { params: {} });

      expect(response.status).toBe(304);
    });

    it('should not add ETag when enableETag is false', async () => {
      const testData = { id: 1, name: 'test' };

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: false });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(200);
      expect(response.headers.has('ETag')).toBe(false);
    });

    it('should not add ETag when enableETag is not specified', async () => {
      const testData = { id: 1, name: 'test' };

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(200);
      expect(response.headers.has('ETag')).toBe(false);
    });

    it('should not add ETag to non-200 responses', async () => {
      const testData = { error: 'Not found' };

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 404 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(404);
      expect(response.headers.has('ETag')).toBe(false);
    });

    it('should not add ETag to non-JSON responses', async () => {
      const handler = withApiHandler(async () => {
        return new NextResponse('plain text', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(200);
      expect(response.headers.has('ETag')).toBe(false);
    });

    it('should handle complex nested data structures', async () => {
      const testData = {
        items: [
          { id: 1, nested: { value: 'a' } },
          { id: 2, nested: { value: 'b' } },
        ],
        meta: { total: 2, page: 1 },
      };

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(200);
      const etag = response.headers.get('ETag');
      expect(etag).toBe(generateETag(testData));
    });

    it('should generate consistent ETags for identical data', async () => {
      const testData = { id: 1, name: 'test' };
      let firstETag: string | null = null;

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      // First request
      const req1 = new NextRequest('http://localhost/api/test');
      const response1 = await handler(req1, { params: {} });
      firstETag = response1.headers.get('ETag');

      // Second request with same data
      const req2 = new NextRequest('http://localhost/api/test');
      const response2 = await handler(req2, { params: {} });
      const secondETag = response2.headers.get('ETag');

      expect(firstETag).toBe(secondETag);
    });

    it('should generate different ETags for different data', async () => {
      const data1 = { id: 1, name: 'test' };
      const data2 = { id: 2, name: 'test' };

      const handler1 = withApiHandler(async () => {
        return NextResponse.json(data1, { status: 200 });
      }, { enableETag: true });

      const handler2 = withApiHandler(async () => {
        return NextResponse.json(data2, { status: 200 });
      }, { enableETag: true });

      const req1 = new NextRequest('http://localhost/api/test');
      const response1 = await handler1(req1, { params: {} });
      const etag1 = response1.headers.get('ETag');

      const req2 = new NextRequest('http://localhost/api/test');
      const response2 = await handler2(req2, { params: {} });
      const etag2 = response2.headers.get('ETag');

      expect(etag1).not.toBe(etag2);
    });

    it('should include correlation ID in all responses', async () => {
      const testData = { id: 1 };

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.headers.has('x-correlation-id')).toBe(true);
      expect(response.headers.has('x-request-id')).toBe(true);
    });

    it('should include Cache-Control header with ETag', async () => {
      const testData = { id: 1 };

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
    });

    it('should handle empty array responses', async () => {
      const testData: unknown[] = [];

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(200);
      expect(response.headers.has('ETag')).toBe(true);
    });

    it('should handle null response body gracefully', async () => {
      const handler = withApiHandler(async () => {
        return new NextResponse(null, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(200);
      // Should not crash, ETag may or may not be added depending on content-type
    });

    it('should handle large payloads', async () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        })),
      };

      const handler = withApiHandler(async () => {
        return NextResponse.json(largeData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(200);
      expect(response.headers.has('ETag')).toBe(true);
      const etag = response.headers.get('ETag');
      expect(etag).toBe(generateETag(largeData));
    });

    it('should handle 304 response with no body', async () => {
      const testData = { id: 1, name: 'test' };
      const currentETag = generateETag(testData);

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'If-None-Match': currentETag },
      });

      const response = await handler(req, { params: {} });

      expect(response.status).toBe(304);
      // 304 responses should have no body
      const text = await response.text();
      expect(text).toBe('');
    });
  });

  describe('ETag with error handling', () => {
    it('should not add ETag to error responses', async () => {
      const handler = withApiHandler(async () => {
        throw new Error('Test error');
      }, { enableETag: true });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(500);
      expect(response.headers.has('ETag')).toBe(false);
    });
  });

  describe('ETag with CORS', () => {
    it('should apply CORS policy to ETag responses', async () => {
      const testData = { id: 1 };

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, {
        enableETag: true,
        cors: { GET: { access: 'public' } },
      });

      const req = new NextRequest('http://localhost/api/test');
      const response = await handler(req, { params: {} });

      expect(response.status).toBe(200);
      expect(response.headers.has('ETag')).toBe(true);
    });

    it('should apply CORS policy to 304 responses', async () => {
      const testData = { id: 1 };
      const currentETag = generateETag(testData);

      const handler = withApiHandler(async () => {
        return NextResponse.json(testData, { status: 200 });
      }, {
        enableETag: true,
        cors: { GET: { access: 'public' } },
      });

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'If-None-Match': currentETag },
      });

      const response = await handler(req, { params: {} });

      expect(response.status).toBe(304);
    });
  });
});
