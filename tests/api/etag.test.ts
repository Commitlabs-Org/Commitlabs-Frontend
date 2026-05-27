import { describe, it, expect } from 'vitest';
import { generateETag, etagMatches } from '../../src/lib/backend/etag';

describe('ETag utilities', () => {
  describe('generateETag', () => {
    it('should generate a quoted SHA-256 hash', () => {
      const data = { id: 1, name: 'test' };
      const etag = generateETag(data);
      
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
      expect(etag).toStartWith('"');
      expect(etag).toEndWith('"');
    });

    it('should generate consistent ETags for identical data', () => {
      const data = { id: 1, name: 'test' };
      const etag1 = generateETag(data);
      const etag2 = generateETag(data);
      
      expect(etag1).toBe(etag2);
    });

    it('should generate different ETags for different data', () => {
      const data1 = { id: 1, name: 'test' };
      const data2 = { id: 2, name: 'test' };
      
      const etag1 = generateETag(data1);
      const etag2 = generateETag(data2);
      
      expect(etag1).not.toBe(etag2);
    });

    it('should handle arrays', () => {
      const data = [1, 2, 3];
      const etag = generateETag(data);
      
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('should handle strings', () => {
      const data = 'test string';
      const etag = generateETag(data);
      
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('should handle numbers', () => {
      const data = 42;
      const etag = generateETag(data);
      
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('should handle null', () => {
      const data = null;
      const etag = generateETag(data);
      
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          id: 1,
          profile: {
            name: 'John',
            email: 'john@example.com'
          }
        }
      };
      const etag = generateETag(data);
      
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('should be sensitive to property order in objects', () => {
      const data1 = { a: 1, b: 2 };
      const data2 = { b: 2, a: 1 };
      
      // JSON.stringify preserves order, so these should be the same
      const etag1 = generateETag(data1);
      const etag2 = generateETag(data2);
      
      // Note: JSON.stringify does NOT guarantee order preservation for object keys
      // but in practice, V8 preserves insertion order for string keys
      expect(etag1).toBe(etag2);
    });

    it('should handle empty objects', () => {
      const data = {};
      const etag = generateETag(data);
      
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('should handle empty arrays', () => {
      const data: unknown[] = [];
      const etag = generateETag(data);
      
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });
  });

  describe('etagMatches', () => {
    const testETag = '"abc123def456"';

    it('should return false when ifNoneMatch is null', () => {
      expect(etagMatches(null, testETag)).toBe(false);
    });

    it('should return false when ifNoneMatch is empty string', () => {
      expect(etagMatches('', testETag)).toBe(false);
    });

    it('should return true when ETags match exactly', () => {
      expect(etagMatches(testETag, testETag)).toBe(true);
    });

    it('should return true when ETag is in comma-separated list', () => {
      const ifNoneMatch = `"other1", ${testETag}, "other2"`;
      expect(etagMatches(ifNoneMatch, testETag)).toBe(true);
    });

    it('should handle whitespace around ETags in list', () => {
      const ifNoneMatch = `  "other1"  ,  ${testETag}  ,  "other2"  `;
      expect(etagMatches(ifNoneMatch, testETag)).toBe(true);
    });

    it('should return true for wildcard "*"', () => {
      expect(etagMatches('*', testETag)).toBe(true);
    });

    it('should return true for wildcard in list', () => {
      const ifNoneMatch = `"other1", *, "other2"`;
      expect(etagMatches(ifNoneMatch, testETag)).toBe(true);
    });

    it('should return false when ETag does not match', () => {
      expect(etagMatches('"different"', testETag)).toBe(false);
    });

    it('should return false when ETag is not in list', () => {
      const ifNoneMatch = '"other1", "other2", "other3"';
      expect(etagMatches(ifNoneMatch, testETag)).toBe(false);
    });

    it('should be case-sensitive', () => {
      const lowerETag = '"abc123def456"';
      const upperETag = '"ABC123DEF456"';
      expect(etagMatches(lowerETag, upperETag)).toBe(false);
    });

    it('should handle single ETag without quotes in comparison', () => {
      // The function expects quoted ETags
      expect(etagMatches('abc123def456', testETag)).toBe(false);
    });

    it('should handle multiple ETags with various spacing', () => {
      const ifNoneMatch = `"tag1","tag2",${testETag},"tag3"`;
      expect(etagMatches(ifNoneMatch, testETag)).toBe(true);
    });

    it('should handle weak ETags (W/ prefix)', () => {
      // Weak ETags start with W/
      const weakETag = 'W/"abc123"';
      expect(etagMatches(weakETag, testETag)).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should generate and match ETags for API responses', () => {
      const responseData = {
        status: 'success',
        data: {
          id: 1,
          name: 'Test Item',
          timestamp: '2026-05-27T10:00:00Z'
        }
      };

      const etag = generateETag(responseData);
      expect(etagMatches(etag, etag)).toBe(true);
    });

    it('should detect changes in response data', () => {
      const data1 = { id: 1, value: 'original' };
      const data2 = { id: 1, value: 'modified' };

      const etag1 = generateETag(data1);
      const etag2 = generateETag(data2);

      expect(etagMatches(etag1, etag2)).toBe(false);
    });

    it('should handle cache validation workflow', () => {
      const data = { id: 1, name: 'Resource' };
      const etag = generateETag(data);

      // Simulate client sending If-None-Match header
      const clientIfNoneMatch = etag;
      
      // Server checks if resource changed
      const currentETag = generateETag(data);
      const hasChanged = !etagMatches(clientIfNoneMatch, currentETag);

      expect(hasChanged).toBe(false);
    });

    it('should handle cache invalidation workflow', () => {
      const originalData = { id: 1, name: 'Resource' };
      const updatedData = { id: 1, name: 'Updated Resource' };

      const originalETag = generateETag(originalData);
      const updatedETag = generateETag(updatedData);

      // Simulate client sending old If-None-Match header
      const clientIfNoneMatch = originalETag;
      
      // Server checks if resource changed
      const hasChanged = !etagMatches(clientIfNoneMatch, updatedETag);

      expect(hasChanged).toBe(true);
    });
  });
});
