// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * sRGB channel → linear luminance (WCAG 2.1 formula)
 */
function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045
    ? s / 12.92
    : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance of an sRGB hex colour.
 */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * WCAG 2.1 contrast ratio between two hex colours.
 */
function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================================
// Token colours (directly from design tokens in globals.css)
// ============================================================================
const TOKENS = {
  surface: {
    base: '#0a0a0a',
    card: '#111111',
    tooltip: '#1a1a1a',
  },
  text: {
    primary: '#ffffff',
    secondary: '#99a1af',
    tertiary: '#8892a0',
    muted: '#808b9e',
  },
  status: {
    positive: '#05DF72',
    warning: '#ff8904',
    danger: '#f87171',
    info: '#51a2ff',
  },
  chart: {
    drawdownTooltipLegacy: '#DC2626',
    drawdownTooltipFixed: '#f87171',
  },
} as const;

type SurfaceKey = keyof typeof TOKENS.surface;

const AA_TEXT = 4.5;
const AA_LARGE = 3.0;

describe('WCAG AA contrast audit — dark theme', () => {
  it.each([
    ['text-tertiary (#8892a0) on surface-base', TOKENS.text.tertiary, 'base', AA_TEXT],
    ['text-tertiary (#8892a0) on surface-card', TOKENS.text.tertiary, 'card', AA_TEXT],
    ['text-tertiary (#8892a0) on surface-tooltip', TOKENS.text.tertiary, 'tooltip', AA_TEXT],
    ['text-muted (#808b9e) on surface-base', TOKENS.text.muted, 'base', AA_TEXT],
    ['text-muted (#808b9e) on surface-card', TOKENS.text.muted, 'card', AA_TEXT],
    ['text-muted (#808b9e) on surface-tooltip', TOKENS.text.muted, 'tooltip', AA_TEXT],
    ['text-secondary (#99a1af) on surface-base', TOKENS.text.secondary, 'base', AA_TEXT],
    ['text-primary (#ffffff) on surface-base', TOKENS.text.primary, 'base', AA_TEXT],
    ['drawdown tooltip (#f87171) on tooltip', TOKENS.chart.drawdownTooltipFixed, 'tooltip', AA_TEXT],
    ['status-positive (#05DF72) on surface-base', TOKENS.status.positive, 'base', AA_TEXT],
    ['status-warning (#ff8904) on surface-base', TOKENS.status.warning, 'base', AA_TEXT],
    ['status-danger (#f87171) on surface-base', TOKENS.status.danger, 'base', AA_TEXT],
    ['status-info (#51a2ff) on surface-base', TOKENS.status.info, 'base', AA_TEXT],
  ])('%s — ratio ≥ %.1f:1', (_label, fg, surface, minRatio) => {
    const bg = TOKENS.surface[surface as SurfaceKey];
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(minRatio);
  });
});

describe('Legacy colour audit — documented failures', () => {
  it('text-tertiary replacement #8892a0 is >= 4.5:1 on #0a0a0a', () => {
    expect(contrastRatio('#8892a0', '#0a0a0a')).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('original #666 fails AA text on #0a0a0a (3.45:1 < 4.5)', () => {
    expect(contrastRatio('#666666', '#0a0a0a')).toBeLessThan(AA_TEXT);
  });

  it('original #64748b fails AA text on #0a0a0a (4.16:1 < 4.5)', () => {
    expect(contrastRatio('#64748b', '#0a0a0a')).toBeLessThan(AA_TEXT);
  });

  it('original #DC2626 on #1a1a1a fails AA text (3.61:1 < 4.5)', () => {
    expect(contrastRatio('#DC2626', '#1a1a1a')).toBeLessThan(AA_TEXT);
  });
});
