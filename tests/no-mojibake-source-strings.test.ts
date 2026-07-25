import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards against mojibake: UTF-8-encoded General Punctuation characters
 * (curly quotes, dashes, ellipses, bullets, trademark sign, etc. — the
 * U+2000-U+206F block) that were decoded as Windows-1252 / Latin-1 and
 * re-encoded as UTF-8, producing garbled sequences like
 * "Search commitmentsâ€¦" instead of "Search commitments…".
 *
 * Every character in that block starts with UTF-8 bytes E2 80 xx, which
 * misread as Windows-1252 always decodes to the literal two-character
 * prefix "â€" (U+00E2, U+20AC) before the corrupted final byte. Legitimate
 * prose containing "â" (e.g. French "âge") is never directly followed by
 * "€", so this pattern has effectively no false positives.
 */
const MOJIBAKE_PATTERN = /â€./gu;

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORED_DIR_NAMES = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage']);
// Test/spec files are excluded: they may legitimately embed a mojibake string
// as a comparison fixture (to assert real source no longer contains it), which
// isn't itself a corruption of user-facing content.
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;
const SOURCE_ROOT = path.resolve(process.cwd(), 'src');

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIR_NAMES.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, files);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !TEST_FILE_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('source encoding — no mojibake', () => {
  it('contains no Windows-1252-mis-decoded UTF-8 punctuation in any src/ file', () => {
    const offenders: Array<{ file: string; matches: string[] }> = [];

    for (const file of collectSourceFiles(SOURCE_ROOT)) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(MOJIBAKE_PATTERN);
      if (matches) {
        offenders.push({
          file: path.relative(process.cwd(), file),
          matches: Array.from(new Set(matches)),
        });
      }
    }

    expect(offenders).toEqual([]);
  });

  it('flags a known mojibake sample so this check can never silently no-op', () => {
    expect('Search commitmentsâ€¦').toMatch(MOJIBAKE_PATTERN);
    expect('Search commitments…').not.toMatch(MOJIBAKE_PATTERN);
  });
});
