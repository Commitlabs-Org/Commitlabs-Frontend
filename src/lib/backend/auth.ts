import { randomBytes } from 'crypto';
import Stellar from '@stellar/stellar-sdk';

// ─── Types ────────────────────────────────────────────────────────────────

export interface NonceRecord {
    nonce: string;
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

// ─── In‑memory storage (TODO: replace with Redis/database) ─────────────────────

const nonceStore = new Map<string, NonceRecord>();

// Clean up expired nonces every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const NONCE_TTL = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
    const now = new Date();
    for (const [key, record] of nonceStore.entries()) {
        if (record.expiresAt < now) {
            nonceStore.delete(key);
        }
    }
}, CLEANUP_INTERVAL);

// ─── Nonce Management ───────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure random nonce.
 */
export function generateNonce(): string {
    return randomBytes(16).toString('hex');
}

/**
 * Store a nonce for a given Stellar address.
 * 
 * TODO: Replace in‑memory storage with Redis or database for production.
 * TODO: Add rate limiting per address to prevent nonce spam.
 */
export function storeNonce(address: string, nonce: string): NonceRecord {
    const now = new Date();
    const record: NonceRecord = {
        nonce,
        address,
        createdAt: now,
        expiresAt: new Date(now.getTime() + NONCE_TTL),
    };
    
    // Store with nonce as key for quick lookup
    nonceStore.set(nonce, record);
    
    // Also store by address for potential cleanup/lookup
    // nonceStore.set(`${address}:${nonce}`, record);
    
    return record;
}

/**
 * Retrieve a nonce record by nonce value.
 */
export function getNonceRecord(nonce: string): NonceRecord | undefined {
    const record = nonceStore.get(nonce);
    if (!record) {
        return undefined;
    }
    
    // Check if expired
    if (record.expiresAt < new Date()) {
        nonceStore.delete(nonce);
        return undefined;
    }
    
    return record;
}

/**
 * Consume/remove a nonce after successful verification.
 */
export function consumeNonce(nonce: string): boolean {
    const record = getNonceRecord(nonce);
    if (record) {
        nonceStore.delete(nonce);
        return true;
    }
    return false;
}

// ─── Signature Verification ─────────────────────────────────────────────────

/**
 * Verify a Stellar signature against a message and address.
 * 
 * Uses the Stellar SDK to verify that the signature was created by the
 * private key corresponding to the provided public address.
 */
export function verifyStellarSignature(
    address: string,
    signature: string,
    message: string
): SignatureVerificationResult {
    try {
        // Validate inputs
        if (!address || !signature || !message) {
            return {
                valid: false,
                error: 'Missing required fields: address, signature, or message',
            };
        }

        // Verify the signature using Stellar SDK
        const isValid = Stellar.verifySignature(address, signature, message);
        
        if (!isValid) {
            return {
                valid: false,
                error: 'Invalid signature',
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
 * Verify a signature request including nonce validation.
 */
export function verifySignatureWithNonce(request: SignatureVerificationRequest): SignatureVerificationResult {
    const { address, signature, message } = request;
    
    // Extract nonce from message (expected format: "Sign in to CommitLabs: {nonce}")
    const nonceMatch = message.match(/Sign in to CommitLabs:\s*([a-f0-9]+)/i);
    if (!nonceMatch) {
        return {
            valid: false,
            error: 'Invalid message format. Expected: "Sign in to CommitLabs: {nonce}"',
        };
    }
    
    const nonce = nonceMatch[1];
    const nonceRecord = getNonceRecord(nonce);
    
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
    
    // If signature is valid, consume the nonce
    if (verificationResult.valid) {
        consumeNonce(nonce);
    }
    
    return verificationResult;
}

// ─── Challenge Message Generation ─────────────────────────────────────────────

/**
 * Generate a challenge message for the user to sign.
 */
export function generateChallengeMessage(nonce: string): string {
    return `Sign in to CommitLabs: ${nonce}`;
}

// ─── Session Management (TODO) ─────────────────────────────────────────────────

/**
 * TODO: Create a session token after successful verification.
 * This should return a JWT or similar session identifier.
 */
export function createSessionToken(address: string): string {
    // TODO: Implement JWT creation or session management
    // For now, return a placeholder
    return `session_${address}_${Date.now()}`;
}

/**
 * TODO: Verify a session token.
 */
export function verifySessionToken(token: string): { valid: boolean; address?: string } {
    // TODO: Implement JWT verification or session validation
    // For now, return placeholder
    return { valid: false };
}
