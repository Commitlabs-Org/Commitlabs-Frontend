import { randomBytes } from 'crypto';
import Stellar from '@stellar/stellar-sdk';
import { getKV } from './kv';

export interface NonceRecord {
  nonce: string;
  address: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionRecord {
    token: string;
    address: string;
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

// ─── Configuration ──────────────────────────────────────────────────────────

const NONCE_TTL_SECONDS = 5 * 60; // 5 minutes

const NONCE_TTL = 5 * 60 * 1000; // 5 minutes
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function generateNonce(): string {
    return randomBytes(16).toString('hex');
}

/**
 * Store a nonce for a given Stellar address in KV store with TTL.
 */
export async function storeNonce(address: string, nonce: string): Promise<NonceRecord> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + NONCE_TTL_SECONDS * 1000);
    
    const record: NonceRecord = {
        nonce,
        address,
        createdAt: now,
        expiresAt,
    };
    
    const kv = getKV();
    const redisKey = `auth:nonce:${nonce}`;
    
    await kv.set(redisKey, record, NONCE_TTL_SECONDS);
    
    return record;
}

/**
 * Retrieve a nonce record by nonce value.
 */
export async function getNonceRecord(nonce: string): Promise<NonceRecord | null> {
    const kv = getKV();
    const redisKey = `auth:nonce:${nonce}`;
    return await kv.get<NonceRecord>(redisKey);
}

/**
 * Consume/remove a nonce after successful verification (Atomic).
 * Uses GETDEL if supported by the KV store.
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
    const kv = getKV();
    const redisKey = `auth:nonce:${nonce}`;
    const record = await kv.getdel<NonceRecord>(redisKey);
    return !!record;
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
        const isValid = Stellar.verifySignature(address, signature, message);
        if (!isValid) return { valid: false, error: 'Invalid signature' };
        return { valid: true, address };
    } catch (error) {
        return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }

/**
 * Verify a signature request including nonce validation.
 */
export async function verifySignatureWithNonce(request: SignatureVerificationRequest): Promise<SignatureVerificationResult> {
    const { address, signature, message } = request;
    let nonce: string;

    if (message.startsWith('[CommitLabs Auth V2]')) {
        const domainMatch = message.match(/Domain: ([^\n]+)/);
        const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
        const expiresMatch = message.match(/ExpiresAt: ([^\n]+)/);

        if (!nonceMatch || !expiresMatch || !domainMatch) {
            return { valid: false, error: 'Invalid V2 message format' };
        }
        if (domainMatch[1].trim() !== 'commitlabs.org') {
            return { valid: false, error: 'Domain mismatch' };
        }
        if (new Date() > new Date(expiresMatch[1].trim())) {
            return { valid: false, error: 'Challenge message expired' };
        }
        nonce = nonceMatch[1];
    } else {
        const nonceMatch = message.match(/Sign in to CommitLabs:\s*([a-f0-9]+)/i);
        if (!nonceMatch) return { valid: false, error: 'Invalid message format' };
        nonce = nonceMatch[1];
    }
    
    const nonce = nonceMatch[1];
    const nonceRecord = await getNonceRecord(nonce);
    
    if (!nonceRecord) {
        return {
            valid: false,
            error: 'Invalid or expired nonce',
        };
    }
    
    if (nonceRecord.address !== address) {
        return {
            valid: false,
            error: 'Nonce address mismatch',
        };
    }
    
    // Verify the signature
    const verificationResult = verifyStellarSignature(address, signature, message);
    
    // If signature is valid, consume the nonce (atomic)
    if (verificationResult.valid) {
        const consumed = await consumeNonce(nonce);
        if (!consumed) {
            return {
                valid: false,
                error: 'Nonce already consumed or expired during verification',
            };
        }
    }

    return {
      valid: true,
      address,
    };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown verification error',
    };
  }
}

export function generateChallengeMessage(nonce: string, domain: string = 'commitlabs.org'): string {
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    return `[CommitLabs Auth V2]\nDomain: ${domain}\nNonce: ${nonce}\nIssuedAt: ${issuedAt}\nExpiresAt: ${expiresAt}`;
}

// ─── Session Management ───────────────────────────────────────────────────────

/**
 * Create a session token after successful verification and store it.
 */
export function createSessionToken(address: string): string {
    const token = `session_${randomBytes(16).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL);

    const record: SessionRecord = {
        token,
        address,
        createdAt: now,
        expiresAt,
    };

    sessionStore.set(token, record);
    return token;
}

/**
 * Verify a session token.
 */
export function verifySessionToken(token: string): { valid: boolean; address?: string } {
    const record = sessionStore.get(token);
    
    if (!record) {
        return { valid: false };
    }

    if (record.expiresAt < new Date()) {
        sessionStore.delete(token);
        return { valid: false };
    }

    return { valid: true, address: record.address };
}

/**
 * Invalidate a session token.
 */
export function revokeSession(token: string): boolean {
    return sessionStore.delete(token);
}

/**
 * Export for testing purposes (in-memory store)
 * @internal
 */
export function _clearStores(): void {
    nonceStore.clear();
    sessionStore.clear();
}

/**
 * Clean up expired and revoked tokens periodically.
 */
setInterval(() => {
    const now = Date.now();
    for (const [token, record] of sessionStore.entries()) {
        // Remove revoked tokens after 7 days
        if (record.revoked && record.revokedAt && 
            now - record.revokedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
            sessionStore.delete(token);
        }
    }
}, 60 * 60 * 1000); // Clean up every hour
