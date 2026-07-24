import { describe, it, expect } from 'vitest';
import {
    parsePaginationParams,
    parseSortParams,
    parseEnumFilter,
    parseRangeFilter,
    paginateArray,
    paginationErrorResponse,
    PaginationParseError,
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
} from '@/lib/backend/pagination';

describe('Pagination Utilities', () => {

    describe('GROUP A: Default parameter handling', () => {
        it('uses defaults when no query params are provided', () => {
            const params = new URLSearchParams();
            const result = parsePaginationParams(params);
            expect(result.page).toBe(DEFAULT_PAGE);
            expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
            expect(result.offset).toBe(0);
        });

        it('defaults page correctly when page is absent and pageSize is present', () => {
            const params = new URLSearchParams({ pageSize: '20' });
            const result = parsePaginationParams(params);
            expect(result.page).toBe(DEFAULT_PAGE);
            expect(result.pageSize).toBe(20);
            expect(result.offset).toBe(0);
        });

        it('defaults pageSize correctly when pageSize is absent and page is present', () => {
            const params = new URLSearchParams({ page: '2' });
            const result = parsePaginationParams(params);
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
            expect(result.offset).toBe(10);
        });
    });

    describe('GROUP B: pageSize clamping (above MAX_PAGE_SIZE)', () => {
        it('accepts pageSize exactly equal to MAX_PAGE_SIZE', () => {
            const params = new URLSearchParams({ pageSize: MAX_PAGE_SIZE.toString() });
            const result = parsePaginationParams(params);
            expect(result.pageSize).toBe(MAX_PAGE_SIZE);
        });

        it('throws PaginationParseError when pageSize is one above MAX_PAGE_SIZE (BUG: should clamp but currently throws)', () => {
            const params = new URLSearchParams({ pageSize: (MAX_PAGE_SIZE + 1).toString() });
            expect(() => parsePaginationParams(params)).toThrow(PaginationParseError);
        });

        it('throws PaginationParseError when pageSize is far above MAX_PAGE_SIZE (BUG: should clamp but currently throws)', () => {
            const params = new URLSearchParams({ pageSize: '9999' });
            expect(() => parsePaginationParams(params)).toThrow(PaginationParseError);
        });

        it('throws PaginationParseError when pageSize = 0', () => {
            const params = new URLSearchParams({ pageSize: '0' });
            expect(() => parsePaginationParams(params)).toThrow(PaginationParseError);
        });

        it('throws PaginationParseError when pageSize = -1', () => {
            const params = new URLSearchParams({ pageSize: '-1' });
            expect(() => parsePaginationParams(params)).toThrow(PaginationParseError);
        });

        it('accepts pageSize = 1 (minimum valid)', () => {
            const params = new URLSearchParams({ pageSize: '1' });
            const result = parsePaginationParams(params);
            expect(result.pageSize).toBe(1);
        });
    });

    describe('GROUP C: Invalid page input', () => {
        it('throws PaginationParseError when page = "abc" (non-numeric string)', () => {
            const params = new URLSearchParams({ page: 'abc' });
            expect(() => parsePaginationParams(params)).toThrow(PaginationParseError);
        });

        it('throws PaginationParseError when page = "-1" (negative)', () => {
            const params = new URLSearchParams({ page: '-1' });
            expect(() => parsePaginationParams(params)).toThrow(PaginationParseError);
        });

        it('throws PaginationParseError when page = "0" (zero)', () => {
            const params = new URLSearchParams({ page: '0' });
            expect(() => parsePaginationParams(params)).toThrow(PaginationParseError);
        });

        it('parses page = "1.5" as 1 (float, BUG: should throw but parseInt currently truncates to 1)', () => {
            const params = new URLSearchParams({ page: '1.5' });
            const result = parsePaginationParams(params);
            expect(result.page).toBe(1);
        });
    });

    describe('GROUP D: meta math (totalPages, hasNextPage, hasPrevPage, offset)', () => {
        const createDummyItems = (count: number) => new Array(count).fill(null).map((_, i) => i);

        it('calculates correctly for first page with more after (100 total, page 1, size 10)', () => {
            const items = createDummyItems(100);
            const params = { page: 1, pageSize: 10, offset: 0 };
            const result = paginateArray(items, params);
            expect(result.meta).toEqual({
                page: 1,
                pageSize: 10,
                total: 100,
                totalPages: 10,
                hasNextPage: true,
                hasPrevPage: false
            });
            expect(result.data.length).toBe(10);
        });

        it('calculates correctly for middle page (100 total, page 5, size 10)', () => {
            const items = createDummyItems(100);
            const params = { page: 5, pageSize: 10, offset: 40 };
            const result = paginateArray(items, params);
            expect(result.meta).toEqual({
                page: 5,
                pageSize: 10,
                total: 100,
                totalPages: 10,
                hasNextPage: true,
                hasPrevPage: true
            });
            expect(result.data.length).toBe(10);
        });

        it('calculates correctly for last page exact fit (100 total, page 10, size 10)', () => {
            const items = createDummyItems(100);
            const params = { page: 10, pageSize: 10, offset: 90 };
            const result = paginateArray(items, params);
            expect(result.meta).toEqual({
                page: 10,
                pageSize: 10,
                total: 100,
                totalPages: 10,
                hasNextPage: false,
                hasPrevPage: true
            });
        });

        it('calculates correctly for last page partial fit (95 total, page 10, size 10)', () => {
            const items = createDummyItems(95);
            const params = { page: 10, pageSize: 10, offset: 90 };
            const result = paginateArray(items, params);
            expect(result.meta).toEqual({
                page: 10,
                pageSize: 10,
                total: 95,
                totalPages: 10,
                hasNextPage: false,
                hasPrevPage: true
            });
            expect(result.data.length).toBe(5);
        });

        it('calculates correctly for zero total items (0 total, page 1, size 10, BUG: totalPages=1 instead of 0)', () => {
            const items = createDummyItems(0);
            const params = { page: 1, pageSize: 10, offset: 0 };
            const result = paginateArray(items, params);
            expect(result.meta).toEqual({
                page: 1,
                pageSize: 10,
                total: 0,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false
            });
        });

        it('calculates correctly for single page where total <= pageSize (5 total, page 1, size 10)', () => {
            const items = createDummyItems(5);
            const params = { page: 1, pageSize: 10, offset: 0 };
            const result = paginateArray(items, params);
            expect(result.meta).toEqual({
                page: 1,
                pageSize: 10,
                total: 5,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false
            });
        });
    });

    describe('GROUP E: sortOrder and sort field validation', () => {
        const allowedFields = ['id', 'createdAt'] as const;

        it('accepts sortOrder="asc"', () => {
            const params = new URLSearchParams({ sortBy: 'id', sortOrder: 'asc' });
            const result = parseSortParams(params, allowedFields, 'createdAt');
            expect(result.sortOrder).toBe('asc');
            expect(result.sortBy).toBe('id');
        });

        it('accepts sortOrder="desc"', () => {
            const params = new URLSearchParams({ sortOrder: 'desc' });
            const result = parseSortParams(params, allowedFields, 'createdAt');
            expect(result.sortOrder).toBe('desc');
            expect(result.sortBy).toBe('createdAt'); // default fallback
        });

        it('throws PaginationParseError when sortOrder="ASC" (uppercase)', () => {
            const params = new URLSearchParams({ sortOrder: 'ASC' });
            expect(() => parseSortParams(params, allowedFields, 'createdAt')).toThrow(PaginationParseError);
        });

        it('throws PaginationParseError when sortOrder="random"', () => {
            const params = new URLSearchParams({ sortOrder: 'random' });
            expect(() => parseSortParams(params, allowedFields, 'createdAt')).toThrow(PaginationParseError);
        });

        it('accepts valid sort field', () => {
            const params = new URLSearchParams({ sortBy: 'createdAt' });
            const result = parseSortParams(params, allowedFields, 'id');
            expect(result.sortBy).toBe('createdAt');
        });

        it('throws PaginationParseError for unknown sort field', () => {
            const params = new URLSearchParams({ sortBy: 'unknown' });
            expect(() => parseSortParams(params, allowedFields, 'id')).toThrow(PaginationParseError);
        });
    });

    describe('GROUP F: Full coverage for other parsers and error response', () => {
        describe('parseEnumFilter', () => {
            const allowed = ['active', 'inactive'] as const;

            it('returns undefined if param is absent', () => {
                const params = new URLSearchParams();
                expect(parseEnumFilter(params, 'status', allowed)).toBeUndefined();
            });

            it('returns the value if it is allowed', () => {
                const params = new URLSearchParams({ status: 'active' });
                expect(parseEnumFilter(params, 'status', allowed)).toBe('active');
            });

            it('throws PaginationParseError if value is not allowed', () => {
                const params = new URLSearchParams({ status: 'pending' });
                expect(() => parseEnumFilter(params, 'status', allowed)).toThrow(PaginationParseError);
            });
        });

        describe('parseRangeFilter', () => {
            it('returns undefined min and max if absent', () => {
                const params = new URLSearchParams();
                const result = parseRangeFilter(params, 'price');
                expect(result).toEqual({ min: undefined, max: undefined });
            });

            it('parses valid min and max', () => {
                const params = new URLSearchParams({ priceMin: '10', priceMax: '50' });
                const result = parseRangeFilter(params, 'price');
                expect(result).toEqual({ min: 10, max: 50 });
            });

            it('throws PaginationParseError if min is not a valid number', () => {
                const params = new URLSearchParams({ priceMin: 'abc' });
                expect(() => parseRangeFilter(params, 'price')).toThrow(PaginationParseError);
            });

            it('throws PaginationParseError if max is not a valid number', () => {
                const params = new URLSearchParams({ priceMax: 'abc' });
                expect(() => parseRangeFilter(params, 'price')).toThrow(PaginationParseError);
            });

            it('throws PaginationParseError if min is below options.min', () => {
                const params = new URLSearchParams({ priceMin: '5' });
                expect(() => parseRangeFilter(params, 'price', { min: 10 })).toThrow(PaginationParseError);
            });

            it('throws PaginationParseError if max is above options.max', () => {
                const params = new URLSearchParams({ priceMax: '150' });
                expect(() => parseRangeFilter(params, 'price', { max: 100 })).toThrow(PaginationParseError);
            });

            it('throws PaginationParseError if min > max', () => {
                const params = new URLSearchParams({ priceMin: '50', priceMax: '10' });
                expect(() => parseRangeFilter(params, 'price')).toThrow(PaginationParseError);
            });
        });

        describe('paginationErrorResponse', () => {
            it('returns a standard 400 NextResponse with correct JSON payload', async () => {
                const error = new PaginationParseError([{ param: 'page', message: 'error msg' }]);
                const response = paginationErrorResponse(error);
                expect(response.status).toBe(400);
                
                const json = await response.json();
                expect(json.success).toBe(false);
                expect(json.error.code).toBe('VALIDATION_ERROR');
                expect(json.error.details).toEqual([{ param: 'page', message: 'error msg' }]);
            });
        });
    });
});
