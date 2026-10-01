/**
 * Single source of truth for sensitive field names that must never appear in
 * logs, error reports, or other exported telemetry.
 */

export const SENSITIVE_FIELDS = new Set([
  'signature',
  'token',
  'nonce',
  'authorization',
  'password',
  'secret',
  'key',
  'privatekey',
  'publickey',
  'mnemonic',
  'seed',
  'hash',
  'digest',
  'auth',
  'bearer',
  'apikey',
  'api_key',
  'session',
  'cookie',
  'csrf',
  'xss',
  'sql',
]);
