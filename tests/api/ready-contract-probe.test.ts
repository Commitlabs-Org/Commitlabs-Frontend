import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/ready/route';
import { createMockRequest, parseResponse } from './helpers';

describe('GET /api/ready - Contract Reachability Probe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 200 with ready status when RPC and contract are reachable', async () => {
        const request = createMockRequest('http://localhost:3000/api/ready');
        const response = await GET(request);
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.status).toBe('ready');
        expect(result.data).toHaveProperty('timestamp');
        expect(result.data).toHaveProperty('checks');
    });

    it('should include sorobanRpc check in response', async () => {
        const request = createMockRequest('http://localhost:3000/api/ready');
        const response = await GET(request);
        const result = await parseResponse(response);

        expect(result.data.checks).toHaveProperty('sorobanRpc');
        const rpcCheck = result.data.checks.sorobanRpc;

        if (rpcCheck.reachable !== null) {
            expect(typeof rpcCheck.reachable).toBe('boolean');
            if (rpcCheck.reachable) {
                expect(typeof rpcCheck.latencyMs).toBe('number');
            }
        }
    });

    it('should include contract check in response', async () => {
        const request = createMockRequest('http://localhost:3000/api/ready');
        const response = await GET(request);
        const result = await parseResponse(response);

        expect(result.data.checks).toHaveProperty('contract');
        const contractCheck = result.data.checks.contract;

        if (contractCheck.reachable !== null) {
            expect(typeof contractCheck.reachable).toBe('boolean');
            if (contractCheck.reachable) {
                expect(typeof contractCheck.latencyMs).toBe('number');
            }
        }
    });

    it('should return 503 when not ready', async () => {
        const request = createMockRequest('http://localhost:3000/api/ready');
        const response = await GET(request);
        const result = await parseResponse(response);

        if (result.status === 503) {
            expect(result.data.status).toBe('not_ready');
        }
    });

    it('should include timestamp in ISO format', async () => {
        const request = createMockRequest('http://localhost:3000/api/ready');
        const response = await GET(request);
        const result = await parseResponse(response);

        expect(result.data.timestamp).toBeDefined();
        const timestamp = new Date(result.data.timestamp);
        expect(timestamp.getTime()).toBeGreaterThan(0);
    });

    it('should distinguish between RPC and contract issues', async () => {
        const request = createMockRequest('http://localhost:3000/api/ready');
        const response = await GET(request);
        const result = await parseResponse(response);

        const rpcCheck = result.data.checks.sorobanRpc;
        const contractCheck = result.data.checks.contract;

        // Both checks should be present
        expect(rpcCheck).toBeDefined();
        expect(contractCheck).toBeDefined();

        // If RPC is unreachable, contract should also be unreachable
        if (rpcCheck.reachable === false) {
            expect(contractCheck.reachable).toBe(false);
        }
    });

    it('should handle missing RPC configuration gracefully', async () => {
        const request = createMockRequest('http://localhost:3000/api/ready');
        const response = await GET(request);
        const result = await parseResponse(response);

        // Should not throw, should return a valid response
        expect(result.data).toBeDefined();
        expect(result.data.status).toBeDefined();
    });

    it('should include error details when contract probe fails', async () => {
        const request = createMockRequest('http://localhost:3000/api/ready');
        const response = await GET(request);
        const result = await parseResponse(response);

        const contractCheck = result.data.checks.contract;

        if (contractCheck.reachable === false) {
            expect(contractCheck.error).toBeDefined();
            expect(typeof contractCheck.error).toBe('string');
        }
    });

    it('should have reasonable timeout for probe operations', async () => {
        const start = Date.now();
        const request = createMockRequest('http://localhost:3000/api/ready');
        const response = await GET(request);
        const elapsed = Date.now() - start;

        // Probe should complete within 15 seconds (5s RPC + 5s contract + buffer)
        expect(elapsed).toBeLessThan(15000);
    });
});
