// Feature flags: enable marketplace for all tests so existing marketplace
// route tests don't break when the gate is active.
process.env.COMMITLABS_FEATURE_MARKETPLACE = 'true';

import '@testing-library/jest-dom/vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import { expect } from 'vitest';

expect.extend(axeMatchers);

expect.extend({
  toStartWith(received: unknown, expected: string) {
    const isStringReceived = typeof received === 'string';
    const isStringExpected = typeof expected === 'string';
    const pass = isStringReceived && isStringExpected && received.startsWith(expected);

    return {
      pass,
      message: () => {
        if (!isStringReceived) {
          const typeDesc = received === null ? 'null' : typeof received;
          return `expected received value to be a string starting with ${JSON.stringify(expected)}, but received ${typeDesc} (${JSON.stringify(received)})`;
        }
        if (!isStringExpected) {
          return `expected prefix to be a string, but received ${typeof expected} (${JSON.stringify(expected)})`;
        }
        return `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to start with ${JSON.stringify(expected)}`;
      },
    };
  },
  toEndWith(received: unknown, expected: string) {
    const isStringReceived = typeof received === 'string';
    const isStringExpected = typeof expected === 'string';
    const pass = isStringReceived && isStringExpected && received.endsWith(expected);

    return {
      pass,
      message: () => {
        if (!isStringReceived) {
          const typeDesc = received === null ? 'null' : typeof received;
          return `expected received value to be a string ending with ${JSON.stringify(expected)}, but received ${typeDesc} (${JSON.stringify(received)})`;
        }
        if (!isStringExpected) {
          return `expected suffix to be a string, but received ${typeof expected} (${JSON.stringify(expected)})`;
        }
        return `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to end with ${JSON.stringify(expected)}`;
      },
    };
  },
});
