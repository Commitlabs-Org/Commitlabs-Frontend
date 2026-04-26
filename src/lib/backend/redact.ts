/**
 * Redaction utility for sensitive fields in backend logs and analytics.
 * 
 * This utility prevents accidental logging of sensitive information like signatures,
 * tokens, nonces, and other security-sensitive values.
 */

/**
 * Default denylist of sensitive field names
 */
const DEFAULT_DENYLIST = new Set([
  'signature',
  'token',
  'nonce',
  'authorization',
  'password',
  'secret',
  'key',
  'privateKey',
  'publicKey',
  'mnemonic',
  'seed',
  'hash',
  'digest',
  'auth',
  'bearer',
  'apikey',
  'apikey',
  'api_key',
  'session',
  'cookie',
  'csrf',
  'xss',
  'sql',
])

/**
 * Configuration options for redaction
 */
interface RedactOptions {
  /** Custom denylist of field names to redact */
  denylist?: string[]
  /** Custom replacement string for redacted values */
  replacement?: string
  /** Whether to perform case-insensitive matching */
  caseInsensitive?: boolean
}

/**
 * Redacts sensitive values from objects, arrays, and primitives
 * 
 * @param data - The data to redact
 * @param options - Configuration options
 * @returns Redacted data with sensitive values replaced
 */
export function redact<T = unknown>(data: T, options: RedactOptions = {}): T {
  const {
    denylist = [],
    replacement = '[REDACTED]',
    caseInsensitive = true
  } = options

  // Combine default denylist with custom denylist
  const denylistSet = new Set([
    ...DEFAULT_DENYLIST,
    ...denylist
  ])

  // Create case-insensitive matcher if enabled
  const shouldRedact = caseInsensitive
    ? (key: string): boolean => {
        const lowerKey = key.toLowerCase()
        return Array.from(denylistSet).some(denyKey => 
          denyKey.toLowerCase() === lowerKey
        )
      }
    : (key: string): boolean => denylistSet.has(key)

  return redactValue(data, shouldRedact, replacement)
}

/**
 * Recursively redacts values in data structures
 */
function redactValue<T = unknown>(
  data: T,
  shouldRedact: (key: string) => boolean,
  replacement: string
): T {
  if (data === null || data === undefined) {
    return data
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return data
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactValue(item, shouldRedact, replacement)) as T
  }

  // Handle Date objects
  if (data instanceof Date) {
    return data
  }

  // Handle Error objects
  if (data instanceof Error) {
    const redactedError = new Error(redactValue(data.message, shouldRedact, replacement) as string)
    redactedError.name = data.name
    redactedError.stack = data.stack
    return redactedError as T
  }

  // Handle plain objects
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(data)) {
      if (shouldRedact(key)) {
        result[key] = replacement
      } else {
        result[key] = redactValue(value, shouldRedact, replacement)
      }
    }
    
    return result as T
  }

  return data
}

/**
 * Utility function to create a redacted version of an object with custom denylist
 */
export function createRedacted<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[]
): Partial<T> {
  return redact(data, { denylist: sensitiveFields }) as Partial<T>
}

/**
 * Checks if a field name is considered sensitive
 */
export function isSensitiveField(fieldName: string): boolean {
  return DEFAULT_DENYLIST.has(fieldName.toLowerCase())
}

/**
 * Adds a field to the default denylist (for runtime configuration)
 */
export function addToDenylist(fieldName: string): void {
  DEFAULT_DENYLIST.add(fieldName.toLowerCase())
}

/**
 * Removes a field from the default denylist (for runtime configuration)
 */
export function removeFromDenylist(fieldName: string): void {
  DEFAULT_DENYLIST.delete(fieldName.toLowerCase())
}
