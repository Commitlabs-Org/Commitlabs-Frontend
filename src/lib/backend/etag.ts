import { createHash } from 'crypto';

function stableSerialize(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`);

  return `{${entries.join(',')}}`;
}

/**
 * Generates a stable ETag from a serialized payload.
 * Uses SHA-256 hash of the JSON-stringified data.
 * 
 * @param data - The data to generate an ETag for
 * @returns A quoted ETag string suitable for HTTP headers
 */
export function generateETag(data: unknown): string {
  const serialized = stableSerialize(data);
  const hash = createHash('sha256').update(serialized).digest('hex');
  return `"${hash}"`;
}

/**
 * Checks if the client's If-None-Match header matches the current ETag.
 * 
 * @param ifNoneMatch - The If-None-Match header value from the request
 * @param currentETag - The current ETag of the resource
 * @returns true if the ETags match (resource unchanged)
 */
export function etagMatches(ifNoneMatch: string | null, currentETag: string): boolean {
  if (!ifNoneMatch) return false;
  
  // Handle multiple ETags separated by commas (weak comparison)
  const tags = ifNoneMatch.split(',').map(tag => tag.trim());
  return tags.includes(currentETag) || tags.includes('*');
}
