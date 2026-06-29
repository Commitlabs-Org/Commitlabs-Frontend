import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  checkRouteCoverage,
  findUndocumentedRoutes,
  formatUndocumentedReport,
  parseOpenApiPaths,
  routeFileToOpenApiPath,
} from './routeCoverage';

describe('routeCoverage', () => {
  it('maps dynamic route segments to OpenAPI path params', () => {
    expect(routeFileToOpenApiPath('src/app/api/commitments/[id]/history/route.ts')).toBe(
      '/api/commitments/{id}/history',
    );
    expect(routeFileToOpenApiPath('src/app/api/health/route.ts')).toBe('/api/health');
    expect(routeFileToOpenApiPath('not-a-route.ts')).toBe('');
  });

  it('parses documented paths from openapi.yaml content', () => {
    const sample = [
      'paths:',
      '  /api/health:',
      '    get:',
      '  /api/commitments/{id}:',
      '    get:',
    ].join('\n');

    expect([...parseOpenApiPaths(sample)]).toEqual(['/api/health', '/api/commitments/{id}']);
  });

  it('detects a route that is missing from the OpenAPI spec', () => {
    const openApi = ['paths:', '  /api/health:', '    get:'].join('\n');
    const routeFiles = ['health/route.ts', 'marketplace/featured/route.ts'];

    const undocumented = findUndocumentedRoutes(routeFiles, parseOpenApiPaths(openApi));

    expect(undocumented).toEqual(['/api/marketplace/featured']);
    expect(formatUndocumentedReport(undocumented)).toContain('/api/marketplace/featured');
  });

  it('reports full coverage when every route file has a matching path', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'route-coverage-'));
    const apiRoot = join(tempRoot, 'api');
    const featuredDir = join(apiRoot, 'marketplace', 'featured');
    mkdirSync(featuredDir, { recursive: true });
    writeFileSync(join(featuredDir, 'route.ts'), 'export const GET = () => null;');
    writeFileSync(join(featuredDir, 'helpers.ts'), 'export const x = 1;');

    const openApiPath = join(tempRoot, 'openapi.yaml');
    writeFileSync(
      openApiPath,
      ['openapi: 3.0.0', 'info:', '  title: test', 'paths:', '  /api/marketplace/featured:', '    get:'].join('\n'),
    );

    const result = checkRouteCoverage(apiRoot, openApiPath);

    expect(result.undocumented).toEqual([]);
    expect(formatUndocumentedReport(result.undocumented)).toContain('All API routes are documented');
  });

  it('ignores non-path lines until the paths section begins', () => {
    const sample = ['openapi: 3.0.0', 'info:', '  title: test', 'paths:', '  /api/ready:', '    get:'].join('\n');

    expect([...parseOpenApiPaths(sample)]).toEqual(['/api/ready']);
  });
});
