import { configureAxe, type AxeMatchers } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

declare module 'vitest' {
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

/**
 * Shared vitest-axe runner configured for jsdom unit/component tests.
 *
 * `color-contrast` is disabled here because jsdom does not implement layout,
 * painting, or HTMLCanvasElement.getContext('2d'), so axe-core cannot compute
 * rendered foreground/background colors in jsdom. Color contrast is verified
 * in real-browser audits (Lighthouse CI) instead.
 */
export const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

export { configureAxe };
