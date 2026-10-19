import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTRACT_ERRORS, EscrowErrorCode, toTxError } from './errors';

interface ErrorFixture {
  input: unknown;
  kind: string;
  code?: number;
}

const fixtureDirectory = join(__dirname, '__fixtures__');
const fixtures = readdirSync(fixtureDirectory)
  .filter((file) => file.endsWith('.json'))
  .map(
    (file) =>
      [file, JSON.parse(readFileSync(join(fixtureDirectory, file), 'utf8')) as ErrorFixture] as const,
  );

describe('toTxError fixtures', () => {
  it.each(fixtures)('maps %s', (_file, fixture) => {
    const error = toTxError(fixture.input);
    expect(error.kind).toBe(fixture.kind);
    if (fixture.code !== undefined) expect(error.code).toBe(fixture.code);
    expect(error.message).toBeTruthy();
  });
});

describe('contract error table', () => {
  it('contains all stable escrow error codes with a message and recovery hint', () => {
    for (
      let code = EscrowErrorCode.AlreadyInitialized;
      code <= EscrowErrorCode.InvalidWasmHash;
      code += 1
    ) {
      expect(CONTRACT_ERRORS[code]).toMatchObject({
        code,
        name: expect.any(String),
        message: expect.any(String),
        hint: expect.any(String),
      });
    }
  });

  it('matches the Rust contract error variants and numeric codes', () => {
    const contractSource = readFileSync(
      join(__dirname, '../../../contracts/escrow/src/lib.rs'),
      'utf8',
    );
    const errorBlock = contractSource.match(/#\[repr\(u32\)\]\s*pub enum Error\s*\{([\s\S]*?)\n\}/);
    expect(errorBlock).not.toBeNull();

    const contractErrors = [...(errorBlock?.[1] ?? '').matchAll(/^\s*(\w+)\s*=\s*(\d+)\s*,/gm)];
    expect(contractErrors).toHaveLength(17);
    for (const [, name, rawCode] of contractErrors) {
      const code = Number(rawCode) as EscrowErrorCode;
      expect(CONTRACT_ERRORS[code]).toMatchObject({ name, code });
    }
  });
});

describe('unknown error inputs', () => {
  it.each([null, 'unexpected', new Error('unexpected'), { arbitrary: true }])(
    'returns a safe fallback for %s',
    (input) => {
      expect(() => toTxError(input)).not.toThrow();
      expect(toTxError(input)).toMatchObject({
        kind: 'failed',
        message: 'The transaction could not be completed.',
      });
    },
  );
});
