import { randomBytes } from "crypto";
import Stellar from "@stellar/stellar-sdk";
import { getKV } from "./kv";

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

const sessionStore = new Map<string, SessionRecord>();

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

export async function storeNonce(
  address: string,
  nonce: string,
): Promise<NonceRecord> {
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

export async function getNonceRecord(
  nonce: string,
): Promise<NonceRecord | null> {
  return await getKV().get<NonceRecord>(`auth:nonce:${nonce}`);
}

export async function consumeNonce(nonce: string): Promise<boolean> {
  const record = await getKV().getdel<NonceRecord>(`auth:nonce:${nonce}`);
  return !!record;
}

function decodeSignature(signature: string): Buffer {
  const trimmed = signature.trim();
  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, "hex");
  }
  return Buffer.from(trimmed, "base64");
}

export function verifyStellarSignature(
  address: string,
  signature: string,
  message: string,
): SignatureVerificationResult {
  try {
    if (!address || !signature || !message) {
      return { valid: false, error: "Missing required fields" };
    }

    const isValidAddress =
      typeof Stellar.StrKey?.isValidEd25519PublicKey === "function" &&
      Stellar.StrKey.isValidEd25519PublicKey(address);

    if (!isValidAddress) {
      return { valid: false, error: "Invalid Stellar address" };
    }

    const keypair = Stellar.Keypair.fromPublicKey(address);
    const verified = keypair.verify(
      Buffer.from(message, "utf8"),
      decodeSignature(signature),
    );

    return verified
      ? { valid: true, address }
      : { valid: false, error: "Invalid signature" };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown verification error",
    };
  }
}

export async function verifySignatureWithNonce(
  request: SignatureVerificationRequest,
): Promise<SignatureVerificationResult> {
  try {
    const { address, signature, message } = request;
    let nonce: string;

    if (message.startsWith("[CommitLabs Auth V2]")) {
      const domainMatch = message.match(/Domain: ([^\n]+)/);
      const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
      const expiresMatch = message.match(/ExpiresAt: ([^\n]+)/);

      if (!domainMatch || !nonceMatch || !expiresMatch) {
        return { valid: false, error: "Invalid V2 message format" };
      }

      if (domainMatch[1].trim() !== "commitlabs.org") {
        return { valid: false, error: "Domain mismatch" };
      }

      if (new Date() > new Date(expiresMatch[1].trim())) {
        return { valid: false, error: "Challenge message expired" };
      }

      nonce = nonceMatch[1];
    } else {
      const nonceMatch = message.match(/Sign in to CommitLabs:\s*([a-f0-9]+)/i);
      if (!nonceMatch) {
        return { valid: false, error: "Invalid message format" };
      }
      nonce = nonceMatch[1];
    }

    const nonceRecord = await getNonceRecord(nonce);
    if (!nonceRecord) {
      return { valid: false, error: "Invalid or expired nonce" };
    }

    if (nonceRecord.address !== address) {
      return { valid: false, error: "Nonce address mismatch" };
    }

    const verificationResult = verifyStellarSignature(address, signature, message);
    if (!verificationResult.valid) {
      return verificationResult;
    }

    const consumed = await consumeNonce(nonce);
    if (!consumed) {
      return {
        valid: false,
        error: "Nonce already consumed or expired during verification",
      };
    }

    return {
      valid: true,
      address,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown verification error",
    };
  }
}

export function generateChallengeMessage(
  nonce: string,
  domain = "commitlabs.org",
): string {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000).toISOString();
  return `[CommitLabs Auth V2]\nDomain: ${domain}\nNonce: ${nonce}\nIssuedAt: ${issuedAt}\nExpiresAt: ${expiresAt}`;
}

export function createSessionToken(address: string): string {
  const token = `session_${randomBytes(16).toString("hex")}`;
  const csrfToken = randomBytes(16).toString("hex");
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
  error?: string;
} {
  const record = sessionStore.get(token);

  if (!record) {
    return { valid: false, error: "Session not found" };
  }

  if (record.expiresAt < new Date()) {
    sessionStore.delete(token);
    return { valid: false, error: "Session expired" };
  }

  return {
    valid: true,
    address: record.address,
    csrfToken: record.csrfToken,
  };
}

export function revokeSession(token: string): boolean {
  return sessionStore.delete(token);
}

export function _clearStores(): void {
  sessionStore.clear();
}
