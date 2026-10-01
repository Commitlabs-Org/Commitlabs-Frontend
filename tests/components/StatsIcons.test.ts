import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * StatsIcons render tests.
 *
 * Because this project uses `jsx: "preserve"` in tsconfig.json (Next.js
 * convention), vitest cannot parse/import `.tsx` source files.  Instead we
 * verify the structural fix directly by reading the source and asserting the
 * destructuring + JSX output patterns that the acceptance criteria require.
 */

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../src/components/icons/StatsIcons.tsx'),
  'utf-8',
);

describe('StatsIcons', () => {
  describe('ActivityIcon', () => {
    it('destructures size with default 24', () => {
      // Look for: ({ size = 24, className })
      expect(SOURCE).toMatch(/ActivityIcon[^)]*\(\{\s*size\s*=\s*24/);
    });

    it('uses size for SVG width and height', () => {
      // Within ActivityIcon's body the svg should use width={size} height={size}
      const afterActivity = SOURCE.split('ActivityIcon')[1];
      const beforeNextExport = afterActivity.split(/export const/)[0];
      expect(beforeNextExport).toMatch(/width=\{size\}/);
      expect(beforeNextExport).toMatch(/height=\{size\}/);
    });

    it('passes className to the SVG element', () => {
      const afterActivity = SOURCE.split('ActivityIcon')[1];
      const beforeNextExport = afterActivity.split(/export const/)[0];
      expect(beforeNextExport).toMatch(/className=\{className\}/);
    });
  });

  describe('DollarIcon', () => {
    it('destructures size with default 24', () => {
      expect(SOURCE).toMatch(/DollarIcon[^)]*\(\{\s*size\s*=\s*24/);
    });

    it('uses size for SVG width and height', () => {
      const afterDollar = SOURCE.split('DollarIcon')[1];
      const beforeNextExport = afterDollar.split(/export const/)[0];
      expect(beforeNextExport).toMatch(/width=\{size\}/);
      expect(beforeNextExport).toMatch(/height=\{size\}/);
    });

    it('passes className to the SVG element', () => {
      const afterDollar = SOURCE.split('DollarIcon')[1];
      const beforeNextExport = afterDollar.split(/export const/)[0];
      expect(beforeNextExport).toMatch(/className=\{className\}/);
    });
  });

  describe('TargetIcon', () => {
    it('destructures size with default 24', () => {
      expect(SOURCE).toMatch(/TargetIcon[^)]*\(\{\s*size\s*=\s*24/);
    });

    it('uses size for SVG width and height', () => {
      const afterTarget = SOURCE.split('TargetIcon')[1];
      const beforeNextExport = afterTarget.split(/export const/)[0];
      expect(afterTarget).toMatch(/width=\{size\}/);
      expect(afterTarget).toMatch(/height=\{size\}/);
    });
  });

  describe('FeesIcon', () => {
    it('destructures size with default 24', () => {
      expect(SOURCE).toMatch(/FeesIcon[^)]*\(\{\s*size\s*=\s*24/);
    });

    it('uses size for SVG width and height', () => {
      const afterFees = SOURCE.split('FeesIcon')[1];
      const beforeNextExport = afterFees.split(/export const/)[0];
      expect(afterFees).toMatch(/width=\{size\}/);
      expect(afterFees).toMatch(/height=\{size\}/);
    });
  });
});
