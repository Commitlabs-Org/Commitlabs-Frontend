import { NextResponse } from 'next/server';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
    page: number;
    pageSize: number;
    offset: number;
}

export interface SortParams<TField extends string> {
    sortBy: TField;
    sortOrder: SortOrder;
}

export interface PaginatedResult<T> {
    data: T[];
    meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

interface ParseError {
    param: string;
    message: string;
}

/**
 * Thrown internally when a query param fails validation.
 * Caught by the route helpers below and converted to a 400 response.
 */
export class PaginationParseError extends Error {
    constructor(public readonly errors: ParseError[]) {
        super(errors.map((e) => e.message).join('; '));
        this.name = 'PaginationParseError';
    }
}

/**
 * Parse `page` and `pageSize` from URLSearchParams with safe defaults.
 *
 * @throws {PaginationParseError} if either value is non-numeric or out of range.
 */
export function parsePaginationParams(
    searchParams: URLSearchParams,
    options: { defaultPageSize?: number; maxPageSize?: number } = {}
): PaginationParams {
    const { defaultPageSize = DEFAULT_PAGE_SIZE, maxPageSize = MAX_PAGE_SIZE } = options;

    const rawPage = searchParams.get('page');
    const rawPageSize = searchParams.get('pageSize');

    const page =
        rawPage !== null ? parsePositiveInt(rawPage, 'page') : DEFAULT_PAGE;
    const pageSize =
        rawPageSize !== null
            ? parsePositiveInt(rawPageSize, 'pageSize', { max: maxPageSize })
            : defaultPageSize;

    return { page, pageSize, offset: (page - 1) * pageSize };
}

/**
 * Parse `sortBy` and `sortOrder` query params.
 *
 * @param searchParams     URLSearchParams from the request URL.
 * @param allowedFields    Whitelist of valid `sortBy` values.
 * @param defaultSortBy    Fallback when the param is absent.
 * @param defaultSortOrder Fallback order when the param is absent (default: 'asc').
 *
 * @throws {PaginationParseError} if a value is not in its whitelist.
 */
export function parseSortParams<TField extends string>(
    searchParams: URLSearchParams,
    allowedFields: readonly TField[],
    defaultSortBy: TField,
    defaultSortOrder: SortOrder = 'asc'
): SortParams<TField> {
    const rawSortBy = searchParams.get('sortBy');
    const rawSortOrder = searchParams.get('sortOrder');

    let sortBy: TField = defaultSortBy;
    if (rawSortBy !== null) {
        if (!allowedFields.includes(rawSortBy as TField)) {
            throw new PaginationParseError([
                {
                    param: 'sortBy',
                    message: `Invalid 'sortBy' value: "${rawSortBy}". Allowed: ${allowedFields.join(', ')}.`,
                },
            ]);
        }
        sortBy = rawSortBy as TField;
    }

    let sortOrder: SortOrder = defaultSortOrder;
    if (rawSortOrder !== null) {
        if (rawSortOrder !== 'asc' && rawSortOrder !== 'desc') {
            throw new PaginationParseError([
                {
                    param: 'sortOrder',
                    message: `Invalid 'sortOrder' value: "${rawSortOrder}". Must be "asc" or "desc".`,
                },
            ]);
        }
        sortOrder = rawSortOrder;
    }

    return { sortBy, sortOrder };
}

/**
 * Parse a single enum-style filter param.
 * Returns `undefined` when the param is absent (no filter applied).
 *
 * @throws {PaginationParseError} if the value is present but not in the allowed set.
 */
export function parseEnumFilter<T extends string>(
    searchParams: URLSearchParams,
    paramName: string,
    allowedValues: readonly T[]
): T | undefined {
    const raw = searchParams.get(paramName);
    if (raw === null) return undefined;

    if (!allowedValues.includes(raw as T)) {
        throw new PaginationParseError([
            {
                param: paramName,
                message: `Invalid '${paramName}' value: "${raw}". Allowed: ${allowedValues.join(', ')}.`,
            },
        ]);
    }

    return raw as T;
}

/**
 * Parse a numeric range filter (`${paramName}Min` / `${paramName}Max`).
 *
 * @throws {PaginationParseError} if a value is non-numeric, out of bounds, or min > max.
 */
export function parseRangeFilter(
    searchParams: URLSearchParams,
    paramName: string,
    options: { min?: number; max?: number } = {}
): { min: number | undefined; max: number | undefined } {
    const rawMin = searchParams.get(`${paramName}Min`);
    const rawMax = searchParams.get(`${paramName}Max`);

    const errors: ParseError[] = [];

    const min = rawMin !== null ? parseFloat(rawMin) : undefined;
    const max = rawMax !== null ? parseFloat(rawMax) : undefined;

    if (rawMin !== null && isNaN(min!)) {
        errors.push({ param: `${paramName}Min`, message: `'${paramName}Min' must be a valid number.` });
    }
    if (rawMax !== null && isNaN(max!)) {
        errors.push({ param: `${paramName}Max`, message: `'${paramName}Max' must be a valid number.` });
    }
    if (errors.length) throw new PaginationParseError(errors);

    if (min !== undefined && options.min !== undefined && min < options.min) {
        errors.push({ param: `${paramName}Min`, message: `'${paramName}Min' must be at least ${options.min}.` });
    }
    if (max !== undefined && options.max !== undefined && max > options.max) {
        errors.push({ param: `${paramName}Max`, message: `'${paramName}Max' must be at most ${options.max}.` });
    }
    if (min !== undefined && max !== undefined && min > max) {
        errors.push({
            param: paramName,
            message: `'${paramName}Min' (${min}) cannot be greater than '${paramName}Max' (${max}).`,
        });
    }

    if (errors.length) throw new PaginationParseError(errors);

    return { min, max };
}

/**
 * Apply pagination to an already-sorted / filtered in-memory array and wrap
 * the result in the standard `PaginatedResult` envelope.
 */
export function paginateArray<T>(
    items: T[],
    { page, pageSize, offset }: PaginationParams
): PaginatedResult<T> {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
        data: items.slice(offset, offset + pageSize),
        meta: {
            page,
            pageSize,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
    };
}

/**
 * Convert a `PaginationParseError` into a standard 400 JSON response.
 */
export function paginationErrorResponse(err: PaginationParseError): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid query parameters.',
                details: err.errors,
            },
        },
        { status: 400 }
    );
}

function parsePositiveInt(
    raw: string,
    paramName: string,
    options: { max?: number } = {}
): number {
    const value = parseInt(raw, 10);

    if (isNaN(value) || value < 1) {
        throw new PaginationParseError([
            { param: paramName, message: `'${paramName}' must be a positive integer.` },
        ]);
    }
    if (options.max !== undefined && value > options.max) {
        throw new PaginationParseError([
            { param: paramName, message: `'${paramName}' must not exceed ${options.max}.` },
        ]);
    }

    return value;
}