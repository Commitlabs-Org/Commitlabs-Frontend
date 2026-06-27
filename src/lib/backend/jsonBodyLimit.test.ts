import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
    parseJsonWithLimit,
    DEFAULT_JSON_BODY_LIMIT_BYTES,
    JSON_BODY_LIMITS,
} from './jsonBodyLimit';
import { PayloadTooLargeError, ValidationError } from './errors';

function makeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('http://localhost/test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body,
    });
}

describe('parseJsonWithLimit', () => {
    it('parses a well-formed JSON body under the default limit', async () => {
        const payload = { hello: 'world', n: 42 };
        const req = makeRequest(JSON.stringify(payload));

        await expect(parseJsonWithLimit(req)).resolves.toEqual(payload);
    });

    it('honours an explicit limitBytes option', async () => {
        const payload = { hello: 'world' };
        const req = makeRequest(JSON.stringify(payload));

        await expect(
            parseJsonWithLimit(req, { limitBytes: 1024 })
        ).resolves.toEqual(payload);
    });

    it('throws PayloadTooLargeError when Content-Length advertises oversized body', async () => {
        const req = makeRequest(JSON.stringify({ x: 'y' }), {
            'content-length': String(DEFAULT_JSON_BODY_LIMIT_BYTES + 1),
        });

        await expect(parseJsonWithLimit(req)).rejects.toBeInstanceOf(
            PayloadTooLargeError
        );
    });

    it('throws PayloadTooLargeError when actual body exceeds the limit', async () => {
        const big = 'a'.repeat(200);
        const req = makeRequest(JSON.stringify({ data: big }));

        const err = await parseJsonWithLimit(req, { limitBytes: 50 }).catch((e) => e);

        expect(err).toBeInstanceOf(PayloadTooLargeError);
        expect((err as PayloadTooLargeError).statusCode).toBe(413);
        expect((err as PayloadTooLargeError).code).toBe('PAYLOAD_TOO_LARGE');
        const details = (err as PayloadTooLargeError).details as {
            limitBytes: number;
            receivedBytes: number;
        };
        expect(details.limitBytes).toBe(50);
        expect(details.receivedBytes).toBeGreaterThan(50);
    });

    it('throws ValidationError for malformed JSON within the limit', async () => {
        const req = makeRequest('not valid json');

        await expect(parseJsonWithLimit(req)).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for an empty body', async () => {
        const req = makeRequest('');

        await expect(parseJsonWithLimit(req)).rejects.toBeInstanceOf(ValidationError);
    });

    it('ignores a non-numeric Content-Length and falls back to byte-length check', async () => {
        const payload = { ok: true };
        const req = makeRequest(JSON.stringify(payload), {
            'content-length': 'not-a-number',
        });

        await expect(parseJsonWithLimit(req)).resolves.toEqual(payload);
    });

    it('rejects a non-positive limit option', async () => {
        const req = makeRequest('{}');

        await expect(parseJsonWithLimit(req, { limitBytes: 0 })).rejects.toThrow(
            /positive finite number/
        );
        await expect(parseJsonWithLimit(req, { limitBytes: -1 })).rejects.toThrow(
            /positive finite number/
        );
    });

    it('accepts JSON that is exactly at the configured limit', async () => {
        // Make a JSON body whose UTF-8 byte length equals the limit.
        const limit = 64;
        // `{"d":"..."}` — 8 non-payload chars, pad the rest with 'a'.
        const padLength = limit - 8;
        const payload = `{"d":"${'a'.repeat(padLength)}"}`;
        expect(Buffer.byteLength(payload, 'utf8')).toBe(limit);

        const req = makeRequest(payload);

        await expect(
            parseJsonWithLimit(req, { limitBytes: limit })
        ).resolves.toEqual({ d: 'a'.repeat(padLength) });
    });

    it('exposes sensible per-route limits', () => {
        expect(JSON_BODY_LIMITS.commitmentsCreate).toBeGreaterThan(0);
        expect(JSON_BODY_LIMITS.attestationsCreate).toBeGreaterThan(0);
        expect(JSON_BODY_LIMITS.marketplaceListingsCreate).toBeGreaterThan(0);
        expect(JSON_BODY_LIMITS.authVerify).toBeGreaterThan(0);

        // Sanity — limits should not be absurdly large.
        for (const v of Object.values(JSON_BODY_LIMITS)) {
            expect(v).toBeLessThanOrEqual(1024 * 1024);
        }
    });

    // ─── Per-route limit enforcement ─────────────────────────────────────
    function atLimitPayload(limit: number): string {
        // `{"d":"..."}` — 8 non-payload chars, pad the rest with 'a'.
        const padLength = limit - 8;
        return `{"d":"${'a'.repeat(padLength)}"}`;
    }

    function oneByteOverPayload(limit: number): string {
        const padLength = limit - 8 + 1;
        return `{"d":"${'a'.repeat(padLength)}"}`;
    }

    describe.each([
        ['commitmentsCreate', JSON_BODY_LIMITS.commitmentsCreate],
        ['attestationsCreate', JSON_BODY_LIMITS.attestationsCreate],
        ['marketplaceListingsCreate', JSON_BODY_LIMITS.marketplaceListingsCreate],
        ['authVerify', JSON_BODY_LIMITS.authVerify],
    ] as const)('per-route limit: %s', (_route, limit) => {
        it('accepts a body at the exact limit', async () => {
            const payload = atLimitPayload(limit);
            expect(Buffer.byteLength(payload, 'utf8')).toBe(limit);

            const req = makeRequest(payload);

            await expect(
                parseJsonWithLimit(req, { limitBytes: limit })
            ).resolves.toEqual({ d: 'a'.repeat(limit - 8) });
        });

        it('throws PayloadTooLargeError when body is one byte over the limit', async () => {
            const payload = oneByteOverPayload(limit);
            expect(Buffer.byteLength(payload, 'utf8')).toBe(limit + 1);

            const req = makeRequest(payload);

            const err = await parseJsonWithLimit(req, { limitBytes: limit }).catch(
                (e) => e
            );

            expect(err).toBeInstanceOf(PayloadTooLargeError);
            expect((err as PayloadTooLargeError).statusCode).toBe(413);
            expect((err as PayloadTooLargeError).code).toBe('PAYLOAD_TOO_LARGE');
            const details = (err as PayloadTooLargeError).details as {
                limitBytes: number;
                receivedBytes: number;
            };
            expect(details.limitBytes).toBe(limit);
            expect(details.receivedBytes).toBe(limit + 1);
        });
    });

    // ─── Content-Length edge cases ────────────────────────────────────────
    it('uses the default limit when no limitBytes option is given', async () => {
        const limit = DEFAULT_JSON_BODY_LIMIT_BYTES;
        const payload = atLimitPayload(limit);
        const req = makeRequest(payload);

        await expect(parseJsonWithLimit(req)).resolves.toEqual({
            d: 'a'.repeat(limit - 8),
        });
    });

    it('rejects a body over the default limit when no option is given', async () => {
        const limit = DEFAULT_JSON_BODY_LIMIT_BYTES;
        const payload = oneByteOverPayload(limit);
        const req = makeRequest(payload);

        await expect(parseJsonWithLimit(req)).rejects.toBeInstanceOf(
            PayloadTooLargeError
        );
    });

    it('throws PayloadTooLargeError when Content-Length exceeds limit but actual body is within limit (lying client)', async () => {
        const req = makeRequest(JSON.stringify({ small: true }), {
            'content-length': String(DEFAULT_JSON_BODY_LIMIT_BYTES + 1),
        });

        await expect(parseJsonWithLimit(req)).rejects.toBeInstanceOf(
            PayloadTooLargeError
        );
    });

    it('accepts a valid body with zero Content-Length header (omitted/lying client)', async () => {
        const req = makeRequest(JSON.stringify({ ok: true }), {
            'content-length': '0',
        });

        await expect(parseJsonWithLimit(req)).resolves.toEqual({ ok: true });
    });

    it('throws ValidationError when Content-Length is zero and body is empty', async () => {
        const req = makeRequest('', {
            'content-length': '0',
        });

        await expect(parseJsonWithLimit(req)).rejects.toBeInstanceOf(
            ValidationError
        );
    });

    it('throws ValidationError for malformed JSON that contains multi-byte UTF-8 characters', async () => {
        const req = makeRequest('{"broken": \u00E9'); // trailing incomplete

        await expect(parseJsonWithLimit(req)).rejects.toBeInstanceOf(
            ValidationError
        );
    });
});
