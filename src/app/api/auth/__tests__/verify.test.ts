import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../verify/route';
import { NextRequest } from 'next/server';
import { generateNonce, storeNonce } from '@/lib/backend/auth';

// Mock dependencies
vi.mock('@/lib/backend/rateLimit');
vi.mock('@/lib/backend/withApiHandler');
vi.mock('@/lib/backend/apiResponse');

describe('/api/auth/verify', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('should verify signature and set secure cookies', async () => {
        const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
        const nonce = 'abcdef1234567890abcdef1234567890';
        const message = `Sign in to CommitLabs: ${nonce}`;
        const signature = 'valid-signature'; // This would be a real signature in practice

        // Store nonce for verification
        storeNonce(address, nonce);

        const requestBody = {
            address,
            signature,
            message,
        };

        const req = new NextRequest('http://localhost:3000/api/auth/verify', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Mock the withApiHandler to call the inner function
        const mockWithApiHandler = vi.fn((handler) => handler);
        vi.doMock('@/lib/backend/withApiHandler', () => ({
            withApiHandler: mockWithApiHandler,
        }));

        // Mock successful verification
        vi.doMock('@/lib/backend/auth', () => ({
            verifySignatureWithNonce: vi.fn(() => ({ valid: true, address })),
            createSessionToken: vi.fn(() => ({
                token: 'jwt-token',
                csrfToken: 'csrf-token',
            })),
        }));

        // Import after mocking
        const { POST: VerifyPOST } = await import('../verify/route');
        const response = await VerifyPOST(req);

        expect(response).toBeInstanceOf(Response);
        
        // Check response body
        const body = await response.json();
        expect(body.verified).toBe(true);
        expect(body.address).toBe(address);
        expect(body.csrfToken).toBe('csrf-token');

        // Check cookies
        const cookies = response.headers.get('set-cookie');
        expect(cookies).toContain('session=');
        expect(cookies).toContain('csrf=');
        expect(cookies).toContain('HttpOnly');
        expect(cookies).toContain('SameSite=Strict');
    });

    it('should reject invalid signatures', async () => {
        const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
        const nonce = 'abcdef1234567890abcdef1234567890';
        const message = `Sign in to CommitLabs: ${nonce}`;
        const signature = 'invalid-signature';

        storeNonce(address, nonce);

        const requestBody = {
            address,
            signature,
            message,
        };

        const req = new NextRequest('http://localhost:3000/api/auth/verify', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Mock failed verification
        vi.doMock('@/lib/backend/auth', () => ({
            verifySignatureWithNonce: vi.fn(() => ({
                valid: false,
                error: 'Invalid signature',
            })),
        }));

        const mockWithApiHandler = vi.fn((handler) => handler);
        vi.doMock('@/lib/backend/withApiHandler', () => ({
            withApiHandler: mockWithApiHandler,
        }));

        const { POST: VerifyPOST } = await import('../verify/route');
        
        expect(async () => await VerifyPOST(req)).rejects.toThrow('Invalid signature');
    });

    it('should handle malformed JSON', async () => {
        const req = new NextRequest('http://localhost:3000/api/auth/verify', {
            method: 'POST',
            body: 'invalid-json',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const mockWithApiHandler = vi.fn((handler) => handler);
        vi.doMock('@/lib/backend/withApiHandler', () => ({
            withApiHandler: mockWithApiHandler,
        }));

        const { POST: VerifyPOST } = await import('../verify/route');
        
        expect(async () => await VerifyPOST(req)).rejects.toThrow('Invalid JSON in request body');
    });

    it('should validate required fields', async () => {
        const requestBody = {
            // Missing required fields
        };

        const req = new NextRequest('http://localhost:3000/api/auth/verify', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const mockWithApiHandler = vi.fn((handler) => handler);
        vi.doMock('@/lib/backend/withApiHandler', () => ({
            withApiHandler: mockWithApiHandler,
        }));

        const { POST: VerifyPOST } = await import('../verify/route');
        
        expect(async () => await VerifyPOST(req)).rejects.toThrow('Invalid request data');
    });
});
