// @ts-ignore
import { createHash } from 'crypto';

/**
 * Generates a stable ETag from a serialized payload.
 * Uses SHA-256 hash of the JSON-stringified data.
 * 
 * @param data - The data to generate an ETag for
 * @returns A quoted ETag string suitable for HTTP headers
 */
export function generateETag(data: unknown): string {
  const serialized = JSON.stringify(data);
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
