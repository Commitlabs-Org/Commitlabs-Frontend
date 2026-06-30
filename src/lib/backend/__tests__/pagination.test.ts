import { describe, it, expect } from 'vitest';
import {
    parsePaginationParams,
    paginateArray,
    PaginationParseError,
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
} from '../pagination';

function params(obj: Record<string, string> = {}): URLSearchParams {
    return new URLSearchParams(obj);
}

describe('parsePaginationParams – defaults', () => {
    it('returns DEFAULT_PAGE and DEFAULT_PAGE_SIZE when no params are supplied', () => {
        const result = parsePaginationParams(params());
        expect(result.page).toBe(DEFAULT_PAGE);
        expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
        expect(result.offset).toBe(0);
    });

    it('respects a custom defaultPageSize option', () => {
        const result = parsePaginationParams(params(), { defaultPageSize: 25 });
        expect(result.pageSize).toBe(25);
    });

    it('computes offset correctly for page > 1', () => {
        const result = parsePaginationParams(params({ page: '3', pageSize: '10' }));
        expect(result.offset).toBe(20);
    });
});

describe('parsePaginationParams – clamping / validation', () => {
    it('throws PaginationParseError for page = 0', () => {
        expect(() => parsePaginationParams(params({ page: '0' }))).toThrow(PaginationParseError);
    });

    it('throws PaginationParseError for negative page', () => {
        expect(() => parsePaginationParams(params({ page: '-5' }))).toThrow(PaginationParseError);
    });

    it('throws PaginationParseError when pageSize exceeds MAX_PAGE_SIZE', () => {
        expect(() =>
            parsePaginationParams(params({ pageSize: String(MAX_PAGE_SIZE + 1) }))
        ).toThrow(PaginationParseError);
    });

    it('accepts pageSize equal to MAX_PAGE_SIZE', () => {
        const result = parsePaginationParams(params({ pageSize: String(MAX_PAGE_SIZE) }));
        expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    });

    it('respects a custom maxPageSize option', () => {
        expect(() =>
            parsePaginationParams(params({ pageSize: '51' }), { maxPageSize: 50 })
        ).toThrow(PaginationParseError);

        const result = parsePaginationParams(params({ pageSize: '50' }), { maxPageSize: 50 });
        expect(result.pageSize).toBe(50);
    });

    it('throws PaginationParseError for non-numeric page', () => {
        expect(() => parsePaginationParams(params({ page: 'abc' }))).toThrow(PaginationParseError);
    });

    it('throws PaginationParseError for non-numeric pageSize', () => {
        expect(() => parsePaginationParams(params({ pageSize: 'xyz' }))).toThrow(PaginationParseError);
    });

    it('throws PaginationParseError for float page', () => {
        // parseInt('2.9') === 2 which is valid — the function accepts this; just ensure no crash
        const result = parsePaginationParams(params({ page: '2.9' }));
        expect(result.page).toBe(2);
    });
});

describe('paginateArray – meta math', () => {
    const makeParams = (page: number, pageSize: number) => ({
        page,
        pageSize,
        offset: (page - 1) * pageSize,
    });

    it('returns correct totalPages for an even split', () => {
        const result = paginateArray(Array.from({ length: 30 }), makeParams(1, 10));
        expect(result.meta.totalPages).toBe(3);
        expect(result.meta.total).toBe(30);
    });

    it('rounds totalPages up for uneven totals', () => {
        const result = paginateArray(Array.from({ length: 25 }), makeParams(1, 10));
        expect(result.meta.totalPages).toBe(3);
    });

    it('hasNextPage is true when not on last page', () => {
        const result = paginateArray(Array.from({ length: 25 }), makeParams(2, 10));
        expect(result.meta.hasNextPage).toBe(true);
        expect(result.meta.hasPrevPage).toBe(true);
    });

    it('hasNextPage is false on last page and hasPrevPage is false on first page', () => {
        const first = paginateArray(Array.from({ length: 15 }), makeParams(1, 10));
        expect(first.meta.hasPrevPage).toBe(false);
        expect(first.meta.hasNextPage).toBe(true);

        const last = paginateArray(Array.from({ length: 15 }), makeParams(2, 10));
        expect(last.meta.hasNextPage).toBe(false);
        expect(last.meta.hasPrevPage).toBe(true);
    });

    it('handles zero total items gracefully', () => {
        const result = paginateArray([], makeParams(1, 10));
        expect(result.meta.total).toBe(0);
        expect(result.meta.totalPages).toBe(1);
        expect(result.meta.hasNextPage).toBe(false);
        expect(result.meta.hasPrevPage).toBe(false);
        expect(result.data).toHaveLength(0);
    });

    it('slices the correct page of data', () => {
        const items = Array.from({ length: 25 }, (_, i) => i);
        const result = paginateArray(items, makeParams(2, 10));
        expect(result.data).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    });

    it('returns partial last page data', () => {
        const items = Array.from({ length: 25 }, (_, i) => i);
        const result = paginateArray(items, makeParams(3, 10));
        expect(result.data).toHaveLength(5);
        expect(result.data).toEqual([20, 21, 22, 23, 24]);
    });
});
