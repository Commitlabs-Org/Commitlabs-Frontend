import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ok, fail, getCorrelationId } from '../apiResponse';

describe('API Response Contract', () => {
    describe('getCorrelationId', () => {
        it('should extract correlation ID from x-correlation-id header', () => {
            const req = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'x-correlation-id': 'test-correlation-123',
                },
            });

            const correlationId = getCorrelationId(req);
            expect(correlationId).toBe('test-correlation-123');
        });

        it('should extract correlation ID from x-request-id header as fallback', () => {
            const req = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'x-request-id': 'fallback-request-456',
                },
            });

            const correlationId = getCorrelationId(req);
            expect(correlationId).toBe('fallback-request-456');
        });

        it('should prefer x-correlation-id over x-request-id', () => {
            const req = new NextRequest('http://localhost:3000/api/test', {
                headers: {
                    'x-correlation-id': 'primary-123',
                    'x-request-id': 'fallback-456',
                },
            });

            const correlationId = getCorrelationId(req);
            expect(correlationId).toBe('primary-123');
        });

        it('should generate new correlation ID when none exists', () => {
            const req = new NextRequest('http://localhost:3000/api/test');

            const correlationId = getCorrelationId(req);
            expect(correlationId).toBeDefined();
            expect(typeof correlationId).toBe('string');
            expect(correlationId.length).toBe(32); // 16 bytes = 32 hex chars
        });

        it('should generate different correlation IDs for different requests', () => {
            const req1 = new NextRequest('http://localhost:3000/api/test');
            const req2 = new NextRequest('http://localhost:3000/api/test');

            const id1 = getCorrelationId(req1);
            const id2 = getCorrelationId(req2);

            expect(id1).not.toBe(id2);
        });
    });

    describe('ok response helper', () => {
        it('should create a standard success response with correlation ID', () => {
            const data = { message: 'Success' };
            const correlationId = 'test-123';

            const response = ok(data, undefined, 200, correlationId);

            expect(response.status).toBe(200);
            expect(response.headers.get('x-correlation-id')).toBe(correlationId);

            return response.json().then((json) => {
                expect(json).toEqual({
                    success: true,
                    data: { message: 'Success' },
                    meta: {
                        correlationId: 'test-123',
                        timestamp: expect.any(String),
                    },
                });
            });
        });

        it('should create response with custom status code', () => {
            const data = { created: true };
            const correlationId = 'test-456';

            const response = ok(data, undefined, 201, correlationId);

            expect(response.status).toBe(201);
            expect(response.headers.get('x-correlation-id')).toBe(correlationId);
        });

        it('should include meta data when provided', () => {
            const data = { items: [] };
            const meta = { total: 0, page: 1 };
            const correlationId = 'test-789';

            const response = ok(data, meta, 200, correlationId);

            return response.json().then((json) => {
                expect(json).toEqual({
                    success: true,
                    data: { items: [] },
                    meta: {
                        correlationId: 'test-789',
                        timestamp: expect.any(String),
                        total: 0,
                        page: 1,
                    },
                });
            });
        });

        it('should handle status as second parameter', () => {
            const data = { message: 'Created' };
            const correlationId = 'test-status';

            const response = ok(data, 201, undefined, correlationId);

            expect(response.status).toBe(201);

            return response.json().then((json) => {
                expect(json).toEqual({
                    success: true,
                    data: { message: 'Created' },
                    meta: {
                        correlationId: 'test-status',
                        timestamp: expect.any(String),
                    },
                });
            });
        });

        it('should not include meta when empty', () => {
            const data = { message: 'Simple' };
            const correlationId = 'test-simple';

            const response = ok(data, undefined, 200, correlationId);

            return response.json().then((json) => {
                expect(json).toEqual({
                    success: true,
                    data: { message: 'Simple' },
                    meta: {
                        correlationId: 'test-simple',
                        timestamp: expect.any(String),
                    },
                });
            });
        });
    });

    describe('fail response helper', () => {
        it('should create a standard error response with correlation ID', () => {
            const correlationId = 'error-123';

            const response = fail('NOT_FOUND', 'Resource not found', undefined, 404, correlationId);

            expect(response.status).toBe(404);
            expect(response.headers.get('x-correlation-id')).toBe(correlationId);

            return response.json().then((json) => {
                expect(json).toEqual({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Resource not found',
                        correlationId: 'error-123',
                        timestamp: expect.any(String),
                    },
                });
            });
        });

        it('should include error details when provided', () => {
            const correlationId = 'error-details';
            const details = { field: 'invalid', value: 'test' };

            const response = fail('VALIDATION_ERROR', 'Invalid input', details, 400, correlationId);

            return response.json().then((json) => {
                expect(json).toEqual({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid input',
                        correlationId: 'error-details',
                        timestamp: expect.any(String),
                        details: { field: 'invalid', value: 'test' },
                    },
                });
            });
        });

        it('should use default status 500 when not specified', () => {
            const correlationId = 'error-default';

            const response = fail('INTERNAL_ERROR', 'Server error', undefined, undefined, correlationId);

            expect(response.status).toBe(500);
        });

        it('should handle missing correlation ID gracefully', () => {
            const response = fail('BAD_REQUEST', 'Bad request');

            expect(response.headers.get('x-correlation-id')).toBeNull();

            return response.json().then((json) => {
                expect(json).toEqual({
                    success: false,
                    error: {
                        code: 'BAD_REQUEST',
                        message: 'Bad request',
                        correlationId: undefined,
                        timestamp: expect.any(String),
                    },
                });
            });
        });
    });

    describe('Response contract consistency', () => {
        it('should maintain consistent structure across all responses', () => {
            const correlationId = 'consistency-test';

            // Success response
            const successResponse = ok({ data: 'test' }, undefined, 200, correlationId);
            // Error response
            const errorResponse = fail('ERROR_CODE', 'Error message', undefined, 400, correlationId);

            return Promise.all([
                successResponse.json(),
                errorResponse.json(),
            ]).then(([successJson, errorJson]) => {
                // Both should have correlation ID in headers
                expect(successResponse.headers.get('x-correlation-id')).toBe(correlationId);
                expect(errorResponse.headers.get('x-correlation-id')).toBe(correlationId);

                // Both should have timestamp in meta/error
                expect(successJson.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
                expect(errorJson.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

                // Both should have correlation ID in response body
                expect(successJson.meta.correlationId).toBe(correlationId);
                expect(errorJson.error.correlationId).toBe(correlationId);
            });
        });

        it('should serialize to valid JSON', () => {
            const correlationId = 'json-test';
            const complexData = {
                nested: {
                    array: [1, 2, 3],
                    object: { key: 'value' },
                },
                null: null,
                number: 42,
                boolean: true,
            };

            const response = ok(complexData, undefined, 200, correlationId);

            return response.json().then((json) => {
                expect(json).toEqual({
                    success: true,
                    data: complexData,
                    meta: {
                        correlationId,
                        timestamp: expect.any(String),
                    },
                });
            });
        });
    });
});
