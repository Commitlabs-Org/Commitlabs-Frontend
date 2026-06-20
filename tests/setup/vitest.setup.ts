import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';

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
