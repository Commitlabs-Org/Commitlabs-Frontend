import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';
import {
  formatZodPath,
  mapZodErrorToFieldErrors,
  validationErrorFromZod,
  type FieldError,
} from './validationErrors';
import { ValidationError } from './errors';

describe('formatZodPath', () => {
  it('returns empty string for empty path (root-level error)', () => {
    expect(formatZodPath([])).toBe('');
  });

  it('joins string segments with dots', () => {
    expect(formatZodPath(['a', 'b', 'c'])).toBe('a.b.c');
  });

  it('formats numeric segments as bracket notation', () => {
    expect(formatZodPath(['arr', 0, 'name'])).toBe('arr[0].name');
  });

  it('handles consecutive numeric segments', () => {
    expect(formatZodPath(['matrix', 0, 1])).toBe('matrix[0][1]');
  });

  it('handles top-level numeric index', () => {
    expect(formatZodPath([0, 'name'])).toBe('[0].name');
  });

  it('stringifies symbol segments safely', () => {
    const sym = Symbol('secret');
    expect(formatZodPath([sym, 'inner'])).toBe('Symbol(secret).inner');
  });
});

describe('mapZodErrorToFieldErrors', () => {
  it('maps a single top-level field issue', () => {
    const schema = z.object({ email: z.string().min(1, 'Email is required') });
    const result = schema.safeParse({ email: '' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const fieldErrors = mapZodErrorToFieldErrors(result.error);
    expect(fieldErrors).toEqual<FieldError[]>([
      { field: 'email', message: 'Email is required' },
    ]);
  });

  it('maps nested object paths using dot notation', () => {
    const schema = z.object({ user: z.object({ profile: z.object({ name: z.string() }) }) });
    const result = schema.safeParse({ user: { profile: { name: 42 } } });
    if (result.success) throw new Error('expected failure');

    const fieldErrors = mapZodErrorToFieldErrors(result.error);
    expect(fieldErrors).toHaveLength(1);
    expect(fieldErrors[0].field).toBe('user.profile.name');
    expect(fieldErrors[0].message).toMatch(/string/i);
  });

  it('maps array index paths using bracket notation', () => {
    const schema = z.object({ items: z.array(z.object({ qty: z.number() })) });
    const result = schema.safeParse({ items: [{ qty: 'bad' }, { qty: 1 }] });
    if (result.success) throw new Error('expected failure');

    const fieldErrors = mapZodErrorToFieldErrors(result.error);
    expect(fieldErrors).toEqual<FieldError[]>([
      { field: 'items[0].qty', message: expect.any(String) as unknown as string },
    ]);
  });

  it('maps root-level refinement failures to empty field', () => {
    const schema = z.string().refine((s) => s.length > 3, 'too short');
    const result = schema.safeParse('hi');
    if (result.success) throw new Error('expected failure');

    const fieldErrors = mapZodErrorToFieldErrors(result.error);
    expect(fieldErrors).toEqual<FieldError[]>([{ field: '', message: 'too short' }]);
  });

  it('preserves order and returns one entry per issue', () => {
    const schema = z.object({
      a: z.string(),
      b: z.number(),
      c: z.string(),
    });
    const result = schema.safeParse({ a: 1, b: 'x', c: 2 });
    if (result.success) throw new Error('expected failure');

    const fieldErrors = mapZodErrorToFieldErrors(result.error);
    expect(fieldErrors.map((e) => e.field)).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates identical (field, message) pairs', () => {
    const issues = [
      { code: 'custom', path: ['a'], message: 'bad' },
      { code: 'custom', path: ['a'], message: 'bad' },
      { code: 'custom', path: ['b'], message: 'bad' },
    ] as unknown as z.core.$ZodIssue[];
    const err = new ZodError(issues);

    const fieldErrors = mapZodErrorToFieldErrors(err);
    expect(fieldErrors).toEqual<FieldError[]>([
      { field: 'a', message: 'bad' },
      { field: 'b', message: 'bad' },
    ]);
  });

  it('keeps same field with different messages as separate entries', () => {
    const issues = [
      { code: 'custom', path: ['a'], message: 'bad 1' },
      { code: 'custom', path: ['a'], message: 'bad 2' },
    ] as unknown as z.core.$ZodIssue[];
    const err = new ZodError(issues);

    const fieldErrors = mapZodErrorToFieldErrors(err);
    expect(fieldErrors).toHaveLength(2);
    expect(fieldErrors.map((e) => e.message)).toEqual(['bad 1', 'bad 2']);
  });

  it('returns an empty array when the ZodError has no issues', () => {
    const err = new ZodError([]);
    expect(mapZodErrorToFieldErrors(err)).toEqual([]);
  });
});

describe('validationErrorFromZod', () => {
  it('returns a ValidationError with fieldErrors in details', () => {
    const schema = z.object({ name: z.string().min(1, 'Name is required') });
    const result = schema.safeParse({ name: '' });
    if (result.success) throw new Error('expected failure');

    const err = validationErrorFromZod(result.error);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Invalid request data.');
    expect(err.details).toEqual({
      fieldErrors: [{ field: 'name', message: 'Name is required' }],
    });
  });

  it('uses the custom message when provided', () => {
    const schema = z.object({ a: z.string() });
    const result = schema.safeParse({ a: 1 });
    if (result.success) throw new Error('expected failure');

    const err = validationErrorFromZod(result.error, 'Bad body');
    expect(err.message).toBe('Bad body');
    expect(
      (err.details as { fieldErrors: FieldError[] }).fieldErrors[0].field
    ).toBe('a');
  });

  it('does not leak the raw ZodError instance in details', () => {
    const schema = z.object({ a: z.string() });
    const result = schema.safeParse({ a: 1 });
    if (result.success) throw new Error('expected failure');

    const err = validationErrorFromZod(result.error);
    const details = err.details as Record<string, unknown>;
    expect(details).not.toHaveProperty('issues');
    expect(details.fieldErrors).not.toBe(result.error.issues);
  });
});
