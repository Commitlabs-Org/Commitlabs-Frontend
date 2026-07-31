import { randomBytes } from 'crypto';
import Stellar from '@stellar/stellar-sdk';
import { getKV } from './kv';

export interface NonceRecord {
  nonce: string;
  address: string;
  createdAt: Date;
  expiresAt: Date;
}

interface SessionRecord {
  token: string;
  address: string;
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface SignatureVerificationRequest {
  address: string;
  signature: string;
  message: string;
}

export interface SignatureVerificationResult {
  valid: boolean;
  address?: string;
  error?: string;
}

const NONCE_TTL_SECONDS = 5 * 60;
const SESSION_TTL = 24 * 60 * 60 * 1000;

/** HttpOnly cookie holding the opaque wallet-auth session token. */
export const AUTH_COOKIE_NAME = 'cl_auth_session';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL / 1000,
};

/**
 * Env vars checked (in priority order) when deriving the default domain.
 *
 * Intentionally duplicates the key set advertised by `cors.ts`'s CORS policy
 * so the auth challenge signs the origin the user actually sees in the URL
 * bar. The list is intentionally NOT imported from `cors.ts` to keep the
 * auth module independent of the request-pipeline module — if you add a new
 * origin env var, update both lists.
 */
const DOMAIN_ENV_KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_APP_URL',
  'SITE_URL',
  'APP_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
] as const;

const DEFAULT_FALLBACK_DOMAIN = 'commitlabs.org';

let _cachedDefaultDomain: string | null = null;

const sessionStore = new Map<string, SessionRecord>();

export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

export async function storeNonce(address: string, nonce: string): Promise<NonceRecord> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + NONCE_TTL_SECONDS * 1000);

  const record: NonceRecord = {
    nonce,
    address,
    createdAt: now,
    expiresAt,
  };

  await getKV().set(`auth:nonce:${nonce}`, record, NONCE_TTL_SECONDS);
  return record;
}

export async function getNonceRecord(nonce: string): Promise<NonceRecord | null> {
  return await getKV().get<NonceRecord>(`auth:nonce:${nonce}`);
}

export async function consumeNonce(nonce: string): Promise<boolean> {
  const record = await getKV().getdel<NonceRecord>(`auth:nonce:${nonce}`);
  return !!record;
}

function decodeSignature(signature: string): Buffer {
  const trimmed = signature.trim();
  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }
  return Buffer.from(trimmed, 'base64');
}

export function verifyStellarSignature(
  address: string,
  signature: string,
  message: string,
): SignatureVerificationResult {
  try {
    if (!address || !signature || !message) {
      return { valid: false, error: 'Missing required fields' };
    }

    const isValidAddress =
      typeof Stellar.StrKey?.isValidEd25519PublicKey === 'function' &&
      Stellar.StrKey.isValidEd25519PublicKey(address);

    if (!isValidAddress) {
      return { valid: false, error: 'Invalid Stellar address' };
    }

    const keypair = Stellar.Keypair.fromPublicKey(address);
    const verified = keypair.verify(Buffer.from(message, 'utf8'), decodeSignature(signature));

    return verified ? { valid: true, address } : { valid: false, error: 'Invalid signature' };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

export async function verifySignatureWithNonce(
  request: SignatureVerificationRequest,
): Promise<SignatureVerificationResult> {
  try {
    const { address, signature, message } = request;
    let nonce: string;

    if (message.startsWith('[CommitLabs Auth V2]')) {
      const domainMatch = message.match(/Domain: ([^\n]+)/);
      const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
      const expiresMatch = message.match(/ExpiresAt: ([^\n]+)/);

      if (!domainMatch || !nonceMatch || !expiresMatch) {
        return { valid: false, error: 'Invalid V2 message format' };
      }

      if (domainMatch[1].trim() !== getDefaultDomain()) {
        return { valid: false, error: 'Domain mismatch' };
      }

      if (new Date() > new Date(expiresMatch[1].trim())) {
        return { valid: false, error: 'Challenge message expired' };
      }

      nonce = nonceMatch[1];
    } else {
      const nonceMatch = message.match(/Sign in to CommitLabs:\s*([a-f0-9]+)/i);
      if (!nonceMatch) {
        return { valid: false, error: 'Invalid message format' };
      }
      nonce = nonceMatch[1];
    }

    const nonceRecord = await getNonceRecord(nonce);
    if (!nonceRecord) {
      return { valid: false, error: 'Invalid or expired nonce' };
    }

    if (nonceRecord.address !== address) {
      return { valid: false, error: 'Nonce address mismatch' };
    }

    const verificationResult = verifyStellarSignature(address, signature, message);
    if (!verificationResult.valid) {
      return verificationResult;
    }

    const consumed = await consumeNonce(nonce);
    if (!consumed) {
      return {
        valid: false,
        error: 'Nonce already consumed or expired during verification',
      };
    }

    return {
      valid: true,
      address,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

/**
 * Resolve the canonical domain used in the anti-phishing `Domain:` field of
 * the V2 challenge message.
 *
 * Resolution order (first hit wins):
 *   1. NEXT_PUBLIC_SITE_URL
 *   2. NEXT_PUBLIC_APP_URL
 *   3. SITE_URL
 *   4. APP_URL
 *   5. VERCEL_PROJECT_PRODUCTION_URL
 *   6. VERCEL_URL
 *   ... fallback to "commitlabs.org".
 *
 * Values are parsed with `new URL()` so the result is always a well-formed
 * hostname (protocol, port, path, query, and basic shape are stripped). If a
 * value does not parse, we silently fall through to the next entry instead of
 * throwing — this keeps the helper safe even if one env var is misconfigured.
 *
 * The result is cached after the first successful call so request hot paths
 * don't pay the `URL` parsing cost on every challenge. Tests can use
 * `_resetDomainCache()` to force a re-resolve against stubbed env values.
 */
export function getDefaultDomain(): string {
  if (_cachedDefaultDomain !== null) {
    return _cachedDefaultDomain;
  }

  for (const key of DOMAIN_ENV_KEYS) {
    const raw = process.env[key];
    if (!raw) continue;

    const candidate = raw.trim();
    if (!candidate) continue;

    try {
      const withProtocol =
        candidate.startsWith('http://') || candidate.startsWith('https://')
          ? candidate
          : `https://${candidate}`;
      const hostname = new URL(withProtocol).hostname;
      // RFC 3986 reg-name allows sub-delims like `!`, so the WHATWG URL
      // parser happily accepts strings like `"!!!"` as a hostname. For an
      // anti-phishing `Domain:` field that's worthless. Allow only DNS-label
      // characters OR a properly-shaped IPv6 literal in brackets.
      //
      // Note: `_` (RFC 2181 underscore labels such as `_dmarc.example.com`)
      // is intentionally excluded — production public hostnames never need
      // it and accepting it only widens the attack surface for an
      // anti-phishing field.
      if (hostname && /^([a-zA-Z0-9.-]+|\[[a-fA-F0-9:]+\])$/.test(hostname)) {
        _cachedDefaultDomain = hostname;
        return _cachedDefaultDomain;
      }
    } catch {
      // Invalid URL — try the next env var.
    }
  }

  _cachedDefaultDomain = DEFAULT_FALLBACK_DOMAIN;
  return _cachedDefaultDomain;
}

/** Clears the cached default domain. Used by tests to pick up stubbed env. */
export function _resetDomainCache(): void {
  _cachedDefaultDomain = null;
}

export function generateChallengeMessage(
  nonce: string,
  domain: string = getDefaultDomain(),
): string {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000).toISOString();
  return `[CommitLabs Auth V2]\nDomain: ${domain}\nNonce: ${nonce}\nIssuedAt: ${issuedAt}\nExpiresAt: ${expiresAt}`;
}

export function createSessionToken(address: string): string {
  const token = `session_${randomBytes(16).toString('hex')}`;
  const csrfToken = randomBytes(16).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL);

  sessionStore.set(token, {
    token,
    address,
    csrfToken,
    createdAt: now,
    expiresAt,
  });

  return token;
}

export function verifySessionToken(token: string): {
  valid: boolean;
  address?: string;
  csrfToken?: string;
  createdAt?: Date;
  error?: string;
} {
  const record = sessionStore.get(token);

  if (!record) {
    return { valid: false, error: 'Session not found' };
  }

  if (record.expiresAt < new Date()) {
    sessionStore.delete(token);
    return { valid: false, error: 'Session expired' };
  }

  return {
    valid: true,
    address: record.address,
    csrfToken: record.csrfToken,
    createdAt: record.createdAt,
  };
}

export function revokeSession(token: string): boolean {
  return sessionStore.delete(token);
}

export interface PublicSessionInfo {
  id: string;
  address: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Return all non-expired sessions for a given address, excluding the current token.
 */
export function listOtherSessions(currentToken: string): PublicSessionInfo[] {
  const now = new Date();
  const current = sessionStore.get(currentToken);
  if (!current) return [];

  const result: PublicSessionInfo[] = [];
  for (const [token, record] of sessionStore.entries()) {
    if (token === currentToken) continue;
    if (record.address !== current.address) continue;
    if (record.expiresAt < now) {
      sessionStore.delete(token);
      continue;
    }
    result.push({
      id: token,
      address: record.address,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
    });
  }
  return result;
}

/**
 * Revoke all sessions for the same address except the current token.
 * Returns the number of sessions revoked.
 */
export function revokeOtherSessions(currentToken: string): number {
  const current = sessionStore.get(currentToken);
  if (!current) return 0;

  let count = 0;
  for (const [token, record] of sessionStore.entries()) {
    if (token === currentToken) continue;
    if (record.address !== current.address) continue;
    sessionStore.delete(token);
    count++;
  }
  return count;
}

export function _clearStores(): void {
  sessionStore.clear();
}
