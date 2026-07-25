import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Byte-level verification, complementing the DOM-level assertions in
// MarketplaceHeader.test.tsx: reads the source file directly to prove the
// placeholder is encoded as the real UTF-8 ellipsis character rather than
// the historical Windows-1252-mojibake sequence.
const filePath = path.resolve(__dirname, 'MarketplaceHeader.tsx');
const source = fs.readFileSync(filePath, 'utf8');

describe('MarketplaceHeader default search placeholder', () => {
  it('defines DEFAULT_PLACEHOLDER as the correctly encoded string', () => {
    expect(source).toContain("const DEFAULT_PLACEHOLDER = 'Search commitments…'");
  });

  it('does not contain the historical mojibake-corrupted placeholder', () => {
    expect(source).not.toContain('â€¦');
  });

  it('encodes the ellipsis as the proper 3-byte UTF-8 sequence for U+2026, not a 7-byte mojibake run', () => {
    const match = source.match(/const DEFAULT_PLACEHOLDER = '([^']*)'/);
    const placeholder = match?.[1] ?? '';

    expect(match).not.toBeNull();
    expect(placeholder).toBe('Search commitments…');
    expect(placeholder.codePointAt(placeholder.length - 1)).toBe(0x2026);

    const trailingBytes = Buffer.from(placeholder, 'utf8').subarray(-3);
    expect(Array.from(trailingBytes)).toEqual([0xe2, 0x80, 0xa6]);
  });
});
