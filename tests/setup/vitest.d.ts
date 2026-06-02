import "vitest";

declare module "vitest" {
  interface Assertion<T = any> {
    toStartWith(expected: string): T;
    toEndWith(expected: string): T;
  }

  interface AsymmetricMatchersContaining {
    toStartWith(expected: string): void;
    toEndWith(expected: string): void;
  }
}
