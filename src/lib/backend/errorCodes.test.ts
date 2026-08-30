import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  ERROR_CODE_REGISTRY,
  getErrorCodeDefinition,
  validateErrorCodeRegistry,
} from './errorCodes';
import { CsrfValidationError } from './errors';
import { methodNotAllowed } from './apiResponse';

describe('ERROR_CODE_REGISTRY', () => {
  it('registers CSRF_INVALID with 403 and non-retriable semantics', () => {
    const def = getErrorCodeDefinition('CSRF_INVALID');
    expect(def.statusCode).toBe(403);
    expect(def.retriable).toBe(false);
    expect(def.code).toBe('CSRF_INVALID');
  });

  it('registers METHOD_NOT_ALLOWED with 405 and non-retriable semantics', () => {
    const def = getErrorCodeDefinition('METHOD_NOT_ALLOWED');
    expect(def.statusCode).toBe(405);
    expect(def.retriable).toBe(false);
    expect(def.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('covers every code emitted by CsrfValidationError and methodNotAllowed', async () => {
    const csrf = new CsrfValidationError();
    const handler = methodNotAllowed(['POST']);
    const res = await handler(new NextRequest('http://localhost/test', { method: 'GET' }), {});
    const body = await res.json();

    expect(ERROR_CODE_REGISTRY[csrf.code]).toBeDefined();
    expect(csrf.code).toBe('CSRF_INVALID');
    expect(res.status).toBe(405);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
    expect(ERROR_CODE_REGISTRY['METHOD_NOT_ALLOWED']).toBeDefined();
  });

  it('passes registry validation without duplicate or unknown codes', () => {
    const result = validateErrorCodeRegistry();
    expect(result.valid).toBe(true);
    expect(result.duplicates).toHaveLength(0);
  });
});
