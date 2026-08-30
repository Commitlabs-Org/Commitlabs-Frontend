import 'vitest';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toStartWith(expected: string): T;
    toEndWith(expected: string): T;
  }

  interface AsymmetricMatchersContaining {
    toStartWith(expected: string): void;
    toEndWith(expected: string): void;
  }
}
