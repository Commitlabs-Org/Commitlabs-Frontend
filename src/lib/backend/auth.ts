import { randomBytes } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';

const SESSION_TOKEN_PREFIX = 'session_';
const SESSION_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const NONCE_TTL_MS = 5 * 60 * 1000;

export const AUTH_COOKIE_NAME = 'cl_session';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
};

export interface NonceRecord {
  nonce: string;
  address: string;
  message: string;
  expiresAt: number;
  consumed: boolean;
}

export interface SignatureVerificationRequest {
  address: string;
  signature: string;
  message: string;
}

export interface SignatureVerificationResult {
  verified: boolean;
  address?: string;
}

export interface PublicSessionInfo {
  id: string;
  address: string;
  createdAt: string;
  current: boolean;
}

const nonceStore = new Map<string, NonceRecord>();
const activeSessions = new Map<string, { address: string; createdAt: number }>();

function generateId(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

export function generateNonce(address: string): { nonce: string; message: string } {
  const nonce = generateId(32);
  const timestamp = Date.now();
  const message = `CommitLabs Authentication\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
  const record: NonceRecord = {
    nonce,
    address,
    message,
    expiresAt: timestamp + NONCE_TTL_MS,
    consumed: false,
  };
  nonceStore.set(nonce, record);
  return { nonce, message };
}

export function getNonceRecord(nonce: string): NonceRecord | undefined {
  const record = nonceStore.get(nonce);
  if (!record) return undefined;
  if (Date.now() > record.expiresAt) {
    nonceStore.delete(nonce);
    return undefined;
  }
  return record;
}

export function storeNonce(address: string, nonce: string, message: string): void {
  nonceStore.set(nonce, {
    nonce,
    address,
    message,
    expiresAt: Date.now() + NONCE_TTL_MS,
    consumed: false,
  });
}

export function consumeNonce(nonce: string): boolean {
  const record = nonceStore.get(nonce);
  if (!record) return false;
  if (record.consumed) return false;
  if (Date.now() > record.expiresAt) {
    nonceStore.delete(nonce);
    return false;
  }
  record.consumed = true;
  return true;
}

export function verifyStellarSignature(
  address: string,
  signature: string,
  message: string,
): boolean {
  try {
    const keypair = Keypair.fromPublicKey(address);
    return keypair.verify(Buffer.from(message, 'utf-8'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export function verifySignatureWithNonce(
  request: SignatureVerificationRequest,
): SignatureVerificationResult {
  const record = getNonceRecordFromMessage(request.message);
  if (!record) {
    return { verified: false };
  }
  if (record.address !== request.address) {
    return { verified: false };
  }
  if (!consumeNonce(record.nonce)) {
    return { verified: false };
  }
  const verified = verifyStellarSignature(request.address, request.signature, request.message);
  return { verified, address: verified ? request.address : undefined };
}

function getNonceRecordFromMessage(message: string): NonceRecord | undefined {
  for (const record of nonceStore.values()) {
    if (record.message === message && !record.consumed) {
      return record;
    }
  }
  return undefined;
}

export function generateChallengeMessage(address: string, nonce: string): string {
  return `CommitLabs Authentication\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
}

export function createSessionToken(address: string): string {
  const token = `${SESSION_TOKEN_PREFIX}${address}_${Date.now()}_${generateId(8)}`;
  activeSessions.set(token, { address, createdAt: Date.now() });
  return token;
}

export function verifySessionToken(token: string): { valid: boolean; address?: string } {
  if (!token || !token.startsWith(SESSION_TOKEN_PREFIX)) {
    return { valid: false };
  }

  const session = activeSessions.get(token);
  if (!session) {
    return { valid: false };
  }

  if (Date.now() - session.createdAt > SESSION_TOKEN_EXPIRY_MS) {
    activeSessions.delete(token);
    return { valid: false };
  }

  return { valid: true, address: session.address };
}

export function revokeSession(token: string): boolean {
  if (!token || !token.startsWith(SESSION_TOKEN_PREFIX)) {
    return false;
  }
  return activeSessions.delete(token);
}

export function listOtherSessions(currentToken: string): PublicSessionInfo[] {
  const sessions: PublicSessionInfo[] = [];
  for (const [token, session] of activeSessions.entries()) {
    if (token === currentToken) continue;
    sessions.push({
      id: token.slice(SESSION_TOKEN_PREFIX.length, token.lastIndexOf('_')),
      address: session.address,
      createdAt: new Date(session.createdAt).toISOString(),
      current: false,
    });
  }
  return sessions;
}

export function revokeOtherSessions(currentToken: string): number {
  let count = 0;
  for (const token of activeSessions.keys()) {
    if (token === currentToken) continue;
    if (activeSessions.delete(token)) {
      count++;
    }
  }
  return count;
}

export function _clearStores(): void {
  nonceStore.clear();
  activeSessions.clear();
}
