import type { NextRequest } from 'next/server';
import { PayloadTooLargeError, ValidationError } from './errors';

/**
 * Default maximum JSON body size, in bytes, enforced for write endpoints.
 *
 * Kept deliberately small — the JSON bodies accepted by Commitlabs routes are
 * tiny (addresses, ids, numbers, a short metadata object). Anything larger is
 * almost certainly abusive or malformed.
 */
export const DEFAULT_JSON_BODY_LIMIT_BYTES = 16 * 1024; // 16 KiB

/**
 * Per-route recommended JSON body size limits, in bytes.
 *
 * Exported so individual routes can opt into a specific limit and so the
 * limits are visible in one place for documentation / auditing.
 */
export const JSON_BODY_LIMITS = {
    commitmentsCreate: 8 * 1024, // 8 KiB — small set of fields + optional metadata
    attestationsCreate: 16 * 1024, // 16 KiB — data object may carry attestation details
    marketplaceListingsCreate: 4 * 1024, // 4 KiB — a handful of short fields
    authVerify: 4 * 1024, // 4 KiB — address + signature + short message
} as const;

export interface ParseJsonWithLimitOptions {
    /** Maximum allowed body size in bytes. Defaults to {@link DEFAULT_JSON_BODY_LIMIT_BYTES}. */
    limitBytes?: number;
}

/**
 * Safely parse a JSON request body, rejecting payloads that exceed a
 * configurable byte limit.
 *
 * Security behaviour:
 *  - If the `Content-Length` header is present and advertises a size greater
 *    than the limit, the request is rejected immediately without reading the
 *    body (cheap DoS protection).
 *  - The body is otherwise read as text and its UTF-8 byte length is checked
 *    against the limit. This guards against clients that omit or lie about
 *    `Content-Length`.
 *  - On overflow, a {@link PayloadTooLargeError} is thrown, which is mapped to
 *    HTTP 413 by {@link withApiHandler}.
 *  - Malformed JSON raises a {@link ValidationError} (HTTP 400), matching the
 *    behaviour previously inlined in each route handler.
 *
 * The return type is `unknown` — callers are expected to validate the shape
 * of the parsed value (e.g. with zod or hand-written guards) before use.
 */
export async function parseJsonWithLimit(
    req: NextRequest | Request,
    options: ParseJsonWithLimitOptions = {},
): Promise<unknown> {
    const limit = options.limitBytes ?? DEFAULT_JSON_BODY_LIMIT_BYTES;

    if (!Number.isFinite(limit) || limit <= 0) {
        throw new Error('parseJsonWithLimit: limitBytes must be a positive finite number.');
    }

    const contentLengthHeader = req.headers.get('content-length');
    if (contentLengthHeader !== null) {
        const advertised = Number(contentLengthHeader);
        if (Number.isFinite(advertised) && advertised > limit) {
            throw new PayloadTooLargeError(
                `Request body exceeds maximum allowed size of ${limit} bytes.`,
                { limitBytes: limit, receivedBytes: advertised },
            );
        }
    }

    let text: string;
    try {
        text = await req.text();
    } catch {
        throw new ValidationError('Failed to read request body.');
    }

    const actualBytes = byteLength(text);
    if (actualBytes > limit) {
        throw new PayloadTooLargeError(
            `Request body exceeds maximum allowed size of ${limit} bytes.`,
            { limitBytes: limit, receivedBytes: actualBytes },
        );
    }

    if (text.length === 0) {
        throw new ValidationError('Request body is empty.');
    }

    try {
        return JSON.parse(text);
    } catch {
        throw new ValidationError('Invalid JSON in request body.');
    }
}

/**
 * Compute the UTF-8 byte length of a string, falling back to `Buffer` when
 * `TextEncoder` is not available (very old runtimes / odd test shims).
 */
function byteLength(value: string): number {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(value).byteLength;
    }
    // Node.js fallback — always available server-side.
    return Buffer.byteLength(value, 'utf8');
}
