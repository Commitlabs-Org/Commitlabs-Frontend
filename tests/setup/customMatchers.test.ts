import { describe, it, expect } from 'vitest';

/**
 * Edge-case tests for the custom Vitest matchers registered in vitest.setup.ts.
 *
 * Covers:
 *  - Normal passing assertions
 *  - Normal negated (not) assertions
 *  - Non-string received values (must fail gracefully)
 *  - Empty-string expected value (every string starts/ends with "")
 */

describe('toStartWith', () => {
  it('passes when the string starts with the expected prefix', () => {
    expect('hello world').toStartWith('hello');
  });

  it('passes for an exact match', () => {
    expect('abc').toStartWith('abc');
  });

  it('passes when expected is an empty string (every string starts with "")', () => {
    expect('anything').toStartWith('');
  });

  it('passes when both received and expected are empty strings', () => {
    expect('').toStartWith('');
  });

  it('fails (negated) when the string does NOT start with the prefix', () => {
    expect('hello world').not.toStartWith('world');
  });

  it('fails (negated) when received does not share the prefix at position 0', () => {
    expect('foobar').not.toStartWith('bar');
  });

  // Non-string received values — the matcher checks typeof received === 'string',
  // so these must fail (i.e., the negated assertion should pass).
  it('fails for a numeric received value', () => {
    expect(42 as unknown as string).not.toStartWith('4');
  });

  it('fails for a null received value', () => {
    expect(null as unknown as string).not.toStartWith('');
  });

  it('fails for an undefined received value', () => {
    expect(undefined as unknown as string).not.toStartWith('');
  });

  it('fails for an object received value', () => {
    expect({} as unknown as string).not.toStartWith('');
  });

  it('fails for an array received value', () => {
    expect([] as unknown as string).not.toStartWith('');
  });
});

describe('toEndWith', () => {
  it('passes when the string ends with the expected suffix', () => {
    expect('hello world').toEndWith('world');
  });

  it('passes for an exact match', () => {
    expect('abc').toEndWith('abc');
  });

  it('passes when expected is an empty string (every string ends with "")', () => {
    expect('anything').toEndWith('');
  });

  it('passes when both received and expected are empty strings', () => {
    expect('').toEndWith('');
  });

  it('fails (negated) when the string does NOT end with the suffix', () => {
    expect('hello world').not.toEndWith('hello');
  });

  it('fails (negated) when received does not share the suffix at the end', () => {
    expect('foobar').not.toEndWith('foo');
  });

  // Non-string received values
  it('fails for a numeric received value', () => {
    expect(42 as unknown as string).not.toEndWith('2');
  });

  it('fails for a null received value', () => {
    expect(null as unknown as string).not.toEndWith('');
  });

  it('fails for an undefined received value', () => {
    expect(undefined as unknown as string).not.toEndWith('');
  });

  it('fails for an object received value', () => {
    expect({} as unknown as string).not.toEndWith('');
  });

  it('fails for an array received value', () => {
    expect([] as unknown as string).not.toEndWith('');
  });
});
