// Feature flags: enable marketplace for all tests so existing marketplace
// route tests don't break when the gate is active.
process.env.COMMITLABS_FEATURE_MARKETPLACE = 'true';

import '@testing-library/jest-dom/vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import { expect } from 'vitest';

expect.extend(axeMatchers);

expect.extend({
  toStartWith(received: string, expected: string) {
    const pass = typeof received === 'string' && received.startsWith(expected);

    return {
      pass,
      message: () =>
        `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to start with ${JSON.stringify(expected)}`,
    };
  },
  toEndWith(received: string, expected: string) {
    const pass = typeof received === 'string' && received.endsWith(expected);

    return {
      pass,
      message: () =>
        `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to end with ${JSON.stringify(expected)}`,
    };
  },
});
