import { describe, it, expect } from 'vitest';
import { generateETag, stableSerialize } from '../../../../src/lib/backend/etag';

describe('stableSerialize', () => {
  it('should be order-independent for object keys', () => {
    const obj1 = { a: 1, b: 2, c: { d: 3, e: 4 } };
    const obj2 = { c: { e: 4, d: 3 }, b: 2, a: 1 };
    expect(stableSerialize(obj1)).toBe(stableSerialize(obj2));
  });

  it('should handle nested objects', () => {
    const obj = { a: { b: { c: 1 } } };
    expect(stableSerialize(obj)).toBe('{"a":{"b":{"c":1}}}');
  });

  it('should handle arrays', () => {
    const arr = [1, { a: 2 }, [3, 4]];
    expect(stableSerialize(arr)).toBe('[1,{"a":2},[3,4]]');
  });

  it('should handle null', () => {
    expect(stableSerialize(null)).toBe('null');
  });

  it('should handle undefined as null', () => {
    expect(stableSerialize(undefined)).toBe('null');
  });

  it('should handle primitives', () => {
    expect(stableSerialize('test')).toBe('"test"');
    expect(stableSerialize(123)).toBe('123');
    expect(stableSerialize(true)).toBe('true');
  });

  it('should handle empty objects and arrays', () => {
    expect(stableSerialize({})).toBe('{}');
    expect(stableSerialize([])).toBe('[]');
  });
});

describe('generateETag', () => {
  it('should generate identical ETags for equivalent objects regardless of key order', () => {
    const obj1 = { a: 1, b: 2, c: { d: 3, e: 4 } };
    const obj2 = { c: { e: 4, d: 3 }, b: 2, a: 1 };
    expect(generateETag(obj1)).toBe(generateETag(obj2));
  });

  it('should generate different ETags for different content', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 3 };
    expect(generateETag(obj1)).not.toBe(generateETag(obj2));
  });

  it('should handle primitives', () => {
    expect(generateETag('test')).toMatch(/^"[a-f0-9]{64}"$/);
    expect(generateETag(123)).toMatch(/^"[a-f0-9]{64}"$/);
    expect(generateETag(true)).toMatch(/^"[a-f0-9]{64}"$/);
  });
});
