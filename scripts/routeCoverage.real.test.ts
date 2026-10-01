import { describe, it, expect } from 'vitest';
import { checkRouteCoverage } from './routeCoverage';
import { join } from 'node:path';

// Path to the repository root openapi.yaml relative to this test file
const openApiPath = join(__dirname, '..', 'openapi.yaml');

describe('Real OpenAPI coverage', () => {
  it('includes /api/health documented path', () => {
    const result = checkRouteCoverage('src/app/api', openApiPath);
    expect(result.documentedPaths.has('/api/health')).toBe(true);
  });
});
