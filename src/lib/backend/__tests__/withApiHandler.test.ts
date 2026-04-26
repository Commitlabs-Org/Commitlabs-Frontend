import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { withApiHandler } from '../withApiHandler';
import { ValidationError, InternalError } from '../errors';
import { ok, fail } from '../apiResponse';

describe('withApiHandler Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Successful responses', () => {
        it('should pass correlation ID to handler and include in response', async () => {
            const mockHandler = vi.fn(async (req, context, correlationId) => {
                expect(correlationId).toBeDefined();
                expect(typeof correlationId).toBe('string');
                return ok({ message: 'Success' }, undefined, 200, correlationId);
            });

            const wrappedHandler = withApiHandler(mockHandler);
            const req = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'x-correlation-id': 'test-123',
                },
            });

            const response = await wrappedHandler(req, { params: {} });

            expect(response.status).toBe(200);
            expect(response.headers.get('x-correlation-id')).toBe('test-123');
            expect(mockHandler).toHaveBeenCalledWith(
                expect.any(NextRequest),
                { params: {} },
                'test-123'
            );

            const json = await response.json();
            expect(json).toEqual({
                success: true,
                data: { message: 'Success' },
                meta: {
                    correlationId: 'test-123',
                    timestamp: expect.any(String),
                },
            });
        });

        it('should generate correlation ID when not provided', async () => {
            const mockHandler = vi.fn(async (req, context, correlationId) => {
                expect(correlationId).toBeDefined();
                expect(typeof correlationId).toBe('string');
                expect(correlationId.length).toBe(32);
                return ok({ message: 'Success' }, undefined, 200, correlationId);
            });

            const wrappedHandler = withApiHandler(mockHandler);
            const req = new NextRequest('http://localhost:3000/api/test');

            const response = await wrappedHandler(req, { params: {} });

            expect(response.status).toBe(200);
            expect(response.headers.get('x-correlation-id')).toBeDefined();
            expect(response.headers.get('x-correlation-id')?.length).toBe(32);

            const json = await response.json();
            expect(json.meta.correlationId).toBe(response.headers.get('x-correlation-id'));
        });

        it('should ensure correlation ID header is always present', async () => {
            const mockHandler = vi.fn(async (req, context, correlationId) => {
                // Return response without correlation ID header
                const response = ok({ message: 'Success' }, undefined, 200, correlationId);
                response.headers.delete('x-correlation-id');
                return response;
            });

            const wrappedHandler = withApiHandler(mockHandler);
            const req = new NextRequest('http://localhost:3000/api/test');

            const response = await wrappedHandler(req, { params: {} });

            // Handler should add correlation ID back
            expect(response.headers.get('x-correlation-id')).toBeDefined();
        });
    });

    describe('Error handling', () => {
        it('should handle ApiError subclasses with correlation ID', async () => {
            const mockHandler = vi.fn(async (req, context, correlationId) => {
                throw new ValidationError('Invalid input', { field: 'test' });
            });

            const wrappedHandler = withApiHandler(mockHandler);
            const req = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'x-correlation-id': 'error-test-123',
                },
            });

            const response = await wrappedHandler(req, { params: {} });

            expect(response.status).toBe(400);
            expect(response.headers.get('x-correlation-id')).toBe('error-test-123');

            const json = await response.json();
            expect(json).toEqual({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input',
                    correlationId: 'error-test-123',
                    timestamp: expect.any(String),
                    details: { field: 'test' },
                },
            });
        });

        it('should handle unknown errors with generic response', async () => {
            const mockHandler = vi.fn(async (req, context, correlationId) => {
                throw new Error('Unexpected error');
            });

            const wrappedHandler = withApiHandler(mockHandler);
            const req = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'x-correlation-id': 'unknown-error-456',
                },
            });

            const response = await wrappedHandler(req, { params: {} });

            expect(response.status).toBe(500);
            expect(response.headers.get('x-correlation-id')).toBe('unknown-error-456');

            const json = await response.json();
            expect(json).toEqual({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred. Please try again later.',
                    correlationId: 'unknown-error-456',
                    timestamp: expect.any(String),
                },
            });
        });

        it('should handle non-Error objects', async () => {
            const mockHandler = vi.fn(async (req, context, correlationId) => {
                throw 'String error';
            });

            const wrappedHandler = withApiHandler(mockHandler);
            const req = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'x-correlation-id': 'string-error-789',
                },
            });

            const response = await wrappedHandler(req, { params: {} });

            expect(response.status).toBe(500);
            expect(response.headers.get('x-correlation-id')).toBe('string-error-789');
        });
    });

    describe('Contract enforcement', () => {
        it('should maintain response contract for all success cases', async () => {
            const testCases = [
                { data: null, status: 200 },
                { data: { items: [] }, status: 200 },
                { data: { created: true }, status: 201 },
                { data: { message: 'No content' }, status: 204 },
            ];

            for (const testCase of testCases) {
                const mockHandler = vi.fn(async (req, context, correlationId) => {
                    return ok(testCase.data, undefined, testCase.status, correlationId);
                });

                const wrappedHandler = withApiHandler(mockHandler);
                const req = new NextRequest('http://localhost:3000/api/test', {
                    headers: {
                        'x-correlation-id': `contract-test-${testCase.status}`,
                    },
                });

                const response = await wrappedHandler(req, { params: {} });

                expect(response.status).toBe(testCase.status);
                expect(response.headers.get('x-correlation-id')).toBe(`contract-test-${testCase.status}`);

                const json = await response.json();
                expect(json).toHaveProperty('success', true);
                expect(json).toHaveProperty('data', testCase.data);
                expect(json).toHaveProperty('meta');
                expect(json.meta).toHaveProperty('correlationId', `contract-test-${testCase.status}`);
                expect(json.meta).toHaveProperty('timestamp');
            }
        });

        it('should maintain response contract for all error cases', async () => {
            const errorCases = [
                { error: new ValidationError('Bad input'), expectedStatus: 400 },
                { error: new InternalError('Server error'), expectedStatus: 500 },
            ];

            for (const errorCase of errorCases) {
                const mockHandler = vi.fn(async (req, context, correlationId) => {
                    throw errorCase.error;
                });

                const wrappedHandler = withApiHandler(mockHandler);
                const req = new NextRequest('http://localhost:3000/api/test', {
                    headers: {
                        'x-correlation-id': `error-contract-${errorCase.expectedStatus}`,
                    },
                });

                const response = await wrappedHandler(req, { params: {} });

                expect(response.status).toBe(errorCase.expectedStatus);
                expect(response.headers.get('x-correlation-id')).toBe(`error-contract-${errorCase.expectedStatus}`);

                const json = await response.json();
                expect(json).toHaveProperty('success', false);
                expect(json).toHaveProperty('error');
                expect(json.error).toHaveProperty('code', errorCase.error.code);
                expect(json.error).toHaveProperty('message', errorCase.error.message);
                expect(json.error).toHaveProperty('correlationId', `error-contract-${errorCase.expectedStatus}`);
                expect(json.error).toHaveProperty('timestamp');
            }
        });
    });

    describe('Request context preservation', () => {
        it('should pass original request and context to handler', async () => {
            const originalReq = new NextRequest('http://localhost:3000/api/test', {
                method: 'POST',
                body: JSON.stringify({ test: 'data' }),
                headers: {
                    'content-type': 'application/json',
                    'x-correlation-id': 'context-test',
                },
            });

            const context = { params: { id: '123' } };

            const mockHandler = vi.fn(async (req, contextParam, correlationId) => {
                expect(req).toBe(originalReq);
                expect(contextParam).toBe(context);
                expect(correlationId).toBe('context-test');
                return ok({ received: true }, undefined, 200, correlationId);
            });

            const wrappedHandler = withApiHandler(mockHandler);
            const response = await wrappedHandler(originalReq, context);

            expect(mockHandler).toHaveBeenCalledWith(originalReq, context, 'context-test');
            expect(response.status).toBe(200);
        });
    });
});
