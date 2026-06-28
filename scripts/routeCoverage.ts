import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROUTE_FILE = 'route.ts';

/** Convert `src/app/api/foo/[id]/bar/route.ts` → `/api/foo/{id}/bar`. */
export function routeFileToOpenApiPath(routeFile: string): string {
  const normalized = routeFile.replace(/\\/g, '/');
  const prefix = 'src/app/api/';
  if (!normalized.startsWith(prefix) || !normalized.endsWith(`/${ROUTE_FILE}`)) {
    return '';
  }

  const segments = normalized.slice(prefix.length, -(`/${ROUTE_FILE}`).length).split('/');
  const apiPath = segments
    .map((segment) => (segment.startsWith('[') && segment.endsWith(']') ? `{${segment.slice(1, -1)}}` : segment))
    .join('/');

  return `/api/${apiPath}`;
}

/** Recursively collect relative paths to every `route.ts` under `apiRoot`. */
export function discoverApiRouteFiles(apiRoot: string, rootDir = apiRoot): string[] {
  const entries = readdirSync(rootDir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(rootDir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...discoverApiRouteFiles(apiRoot, fullPath));
      continue;
    }

    if (entry === ROUTE_FILE) {
      files.push(relative(apiRoot, fullPath).replace(/\\/g, '/'));
    }
  }

  return files.sort();
}

/** Parse top-level path keys from an OpenAPI YAML file. */
export function parseOpenApiPaths(openApiContent: string): Set<string> {
  const paths = new Set<string>();
  let inPaths = false;

  for (const rawLine of openApiContent.split(/\r?\n/)) {
    const line = rawLine;
    if (!inPaths) {
      if (line === 'paths:') {
        inPaths = true;
      }
      continue;
    }

    const match = line.match(/^  (\/api\/[^:]+):/);
    if (match) {
      paths.add(match[1]);
    }
  }

  return paths;
}

export function findUndocumentedRoutes(routeFiles: string[], documentedPaths: Set<string>): string[] {
  return routeFiles
    .map((file) => routeFileToOpenApiPath(`src/app/api/${file}`))
    .filter((path) => path.length > 0 && !documentedPaths.has(path))
    .sort();
}

export interface RouteCoverageResult {
  routeFiles: string[];
  documentedPaths: Set<string>;
  undocumented: string[];
}

export function checkRouteCoverage(apiRoot: string, openApiPath: string): RouteCoverageResult {
  const routeFiles = discoverApiRouteFiles(apiRoot);
  const openApiContent = readFileSync(openApiPath, 'utf8');
  const documentedPaths = parseOpenApiPaths(openApiContent);
  const undocumented = findUndocumentedRoutes(routeFiles, documentedPaths);

  return { routeFiles, documentedPaths, undocumented };
}

export function formatUndocumentedReport(undocumented: string[]): string {
  if (undocumented.length === 0) {
    return 'All API routes are documented in openapi.yaml.';
  }

  const lines = ['Undocumented API routes (missing from openapi.yaml):'];
  for (const path of undocumented) {
    lines.push(`  - ${path}`);
  }
  return lines.join('\n');
}
