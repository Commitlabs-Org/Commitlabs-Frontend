import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as nonceHandler } from '@/app/api/auth/nonce/route';
import { POST as verifyHandler } from '@/app/api/auth/verify/route';
import { createMockRequest, parseResponse } from './helpers';
import Stellar from '@stellar/stellar-sdk';
import { getKV } from '@/lib/backend/kv';

// Mock Stellar SDK
vi.mock('@stellar/stellar-sdk', () => ({
    default: {
        verifySignature: vi.fn(),
    },
}));

describe('Auth API', () => {
    const mockAddress = 'GBRPYH6QC6WGLS33ADC6ZZZ2ZXZXZXZXZXZXZXZXZXZXZXZXZXZX';
    const kv = getKV();

    beforeEach(async () => {
        vi.clearAllMocks();
        // Clear KV store if possible or use a fresh prefix
        // Since it's a MemoryKVStore in tests, we can just let it be or add a clear method
    });

    describe('POST /api/auth/nonce', () => {
        it('should generate a nonce for a valid address', async () => {
            const req = createMockRequest('http://localhost/api/auth/nonce', {
                method: 'POST',
                body: { address: mockAddress },
            });

            const response = await nonceHandler(req);
            const { status, data } = await parseResponse(response);

            expect(status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.nonce).toBeDefined();
            expect(data.data.message).toContain(data.data.nonce);
        });

        it('should return 400 if address is missing', async () => {
            const req = createMockRequest('http://localhost/api/auth/nonce', {
                method: 'POST',
                body: {},
            });

            const response = await nonceHandler(req);
            const { status, data } = await parseResponse(response);

            expect(status).toBe(400);
            expect(data.success).toBe(false);
        });

        it('should rate limit nonce issuance per address', async () => {
            // Default limit is 3 per 5 minutes per address
            for (let i = 0; i < 3; i++) {
                const req = createMockRequest('http://localhost/api/auth/nonce', {
                    method: 'POST',
                    body: { address: mockAddress },
                });
                await nonceHandler(req);
            }

            // 4th request should fail
            const req4 = createMockRequest('http://localhost/api/auth/nonce', {
                method: 'POST',
                body: { address: mockAddress },
            });
            const response = await nonceHandler(req4);
            const { status } = await parseResponse(response);

            expect(status).toBe(429);
        });
    });

    describe('POST /api/auth/verify', () => {
        it('should verify a valid signature and consume the nonce', async () => {
            // 1. Get a nonce
            const nonceReq = createMockRequest('http://localhost/api/auth/nonce', {
                method: 'POST',
                body: { address: mockAddress },
            });
            const nonceRes = await nonceHandler(nonceReq);
            const { data: nonceData } = await parseResponse(nonceRes);
            const nonce = nonceData.data.nonce;
            const message = nonceData.data.message;

            // 2. Mock successful Stellar verification
            (Stellar.verifySignature as any).mockReturnValue(true);

            // 3. Verify
            const verifyReq = createMockRequest('http://localhost/api/auth/verify', {
                method: 'POST',
                body: {
                    address: mockAddress,
                    signature: 'mock_signature',
                    message: message,
                },
            });

            const response = await verifyHandler(verifyReq);
            const { status, data } = await parseResponse(response);

            expect(status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.verified).toBe(true);
            expect(data.data.sessionToken).toBeDefined();

            // 4. Try to reuse the same nonce (replay attack)
            const replayReq = createMockRequest('http://localhost/api/auth/verify', {
                method: 'POST',
                body: {
                    address: mockAddress,
                    signature: 'mock_signature',
                    message: message,
                },
            });

            const replayResponse = await verifyHandler(replayReq);
            const { status: replayStatus } = await parseResponse(replayResponse);

            expect(replayStatus).toBe(401); // Nonce should be consumed
        });

        it('should return 401 for invalid signature', async () => {
            // 1. Get a nonce
            const nonceReq = createMockRequest('http://localhost/api/auth/nonce', {
                method: 'POST',
                body: { address: mockAddress },
            });
            const nonceRes = await nonceHandler(nonceReq);
            const { data: nonceData } = await parseResponse(nonceRes);
            
            // 2. Mock failed Stellar verification
            (Stellar.verifySignature as any).mockReturnValue(false);

            // 3. Verify
            const verifyReq = createMockRequest('http://localhost/api/auth/verify', {
                method: 'POST',
                body: {
                    address: mockAddress,
                    signature: 'invalid_signature',
                    message: nonceData.data.message,
                },
            });

            const response = await verifyHandler(verifyReq);
            const { status } = await parseResponse(response);

            expect(status).toBe(401);
        });

        it('should return 401 for expired or non-existent nonce', async () => {
            const verifyReq = createMockRequest('http://localhost/api/auth/verify', {
                method: 'POST',
                body: {
                    address: mockAddress,
                    signature: 'mock_signature',
                    message: 'Sign in to CommitLabs: deadbeefdeadbeefdeadbeefdeadbeef',
                },
            });

            const response = await verifyHandler(verifyReq);
            const { status } = await parseResponse(response);

            expect(status).toBe(401);
        });

        it('should return 401 if address mismatch', async () => {
            // 1. Get a nonce for address A
            const nonceReq = createMockRequest('http://localhost/api/auth/nonce', {
                method: 'POST',
                body: { address: mockAddress },
            });
            const nonceRes = await nonceHandler(nonceReq);
            const { data: nonceData } = await parseResponse(nonceRes);

            // 2. Try to verify with address B
            const otherAddress = 'GCR6ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';
            const verifyReq = createMockRequest('http://localhost/api/auth/verify', {
                method: 'POST',
                body: {
                    address: otherAddress,
                    signature: 'mock_signature',
                    message: nonceData.data.message,
                },
            });

            const response = await verifyHandler(verifyReq);
            const { status } = await parseResponse(response);

            expect(status).toBe(401);
        });
    });
});
