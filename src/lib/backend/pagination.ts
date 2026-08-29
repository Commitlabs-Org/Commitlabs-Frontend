// src/lib/backend/pagination.ts
//
// Shared pagination & sorting utilities for list/search API routes.
//
// Centralizes bound-setting (page/pageSize limits, allowed sort fields) so
// every list endpoint enforces the same invariants instead of each route
// re-implementing — and potentially drifting on — its own limits.

import { fail } from './apiResponse';

// ─── Bounds ───────────────────────────────────────────

/** Minimum allowed page number (1-indexed). */
export const MIN_PAGE = 1;
/** Minimum allowed page size. */
export const MIN_PAGE_SIZE = 1;
/**
 * Maximum allowed page size. Keeps a single request's response payload and
 * in-memory sort/filter work bounded, regardless of how many total items
 * exist for the caller.
 */
export const MAX_PAGE_SIZE = 100;
/** Page size used when the caller omits `pageSize`. */
export const DEFAULT_PAGE_SIZE = 10;
/** Page used when the caller omits `page`. */
export const DEFAULT_PAGE = 1;

export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

type PaginationField = 'page' | 'pageSize' | 'sortBy' | 'sortOrder';

/**
 * Thrown when a caller-supplied pagination/sort query param is present but
 * invalid (non-numeric, non-integer, out of range, or not an allowed sort
 * field). Deliberately distinct from silently clamping: a request for
 * `pageSize=99999` should fail loudly, not quietly become `pageSize=100`,
 * so the caller's own bound-checking (e.g. "did I get everything I asked
 * for?") isn't fooled by a mismatch it never sees.
 */
export class PaginationParseError extends Error {
  constructor(
    message: string,
    public readonly field: PaginationField,
    public readonly value: string | null,
  ) {
    super(message);
    this.name = 'PaginationParseError';
  }
}

function parseBoundedInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
  field: 'page' | 'pageSize',
): number {
  if (raw === null || raw === '') return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new PaginationParseError(`'${field}' must be an integer.`, field, raw);
  }
  if (parsed < min || parsed > max) {
    throw new PaginationParseError(`'${field}' must be between ${min} and ${max}.`, field, raw);
  }
  return parsed;
}

/**
 * Parses and bounds `page`/`pageSize` from a query string. Both are
 * optional and fall back to the defaults above when omitted.
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = parseBoundedInt(
    searchParams.get('page'),
    DEFAULT_PAGE,
    MIN_PAGE,
    Number.MAX_SAFE_INTEGER,
    'page',
  );
  const pageSize = parseBoundedInt(
    searchParams.get('pageSize'),
    DEFAULT_PAGE_SIZE,
    MIN_PAGE_SIZE,
    MAX_PAGE_SIZE,
    'pageSize',
  );

  return { page, pageSize };
}

/**
 * Parses `sortBy`/`sortOrder`, restricting `sortBy` to `allowedFields` so a
 * caller can't force a sort on an arbitrary/unexpected field.
 */
export function parseSortParams<F extends readonly string[]>(
  searchParams: URLSearchParams,
  allowedFields: F,
  defaultField: F[number],
  defaultOrder: SortOrder,
): { sortBy: F[number]; sortOrder: SortOrder } {
  const rawSortBy = searchParams.get('sortBy');
  let sortBy: F[number] = defaultField;
  if (rawSortBy !== null && rawSortBy !== '') {
    if (!(allowedFields as readonly string[]).includes(rawSortBy)) {
      throw new PaginationParseError(
        `'sortBy' must be one of: ${allowedFields.join(', ')}.`,
        'sortBy',
        rawSortBy,
      );
    }
    sortBy = rawSortBy;
  }

  const rawSortOrder = searchParams.get('sortOrder');
  let sortOrder: SortOrder = defaultOrder;
  if (rawSortOrder !== null && rawSortOrder !== '') {
    if (rawSortOrder !== 'asc' && rawSortOrder !== 'desc') {
      throw new PaginationParseError(
        `'sortOrder' must be 'asc' or 'desc'.`,
        'sortOrder',
        rawSortOrder,
      );
    }
    sortOrder = rawSortOrder;
  }

  return { sortBy, sortOrder };
}

/**
 * Slices an already-filtered/sorted in-memory array into one page.
 *
 * A page past the end returns an empty `data` array rather than an error —
 * pagination past the last page is a normal, valid empty-state, not a
 * client mistake.
 */
export function paginateArray<T>(items: T[], params: PaginationParams): PaginatedResult<T> {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.pageSize);
  const start = (params.page - 1) * params.pageSize;
  const data = start >= total ? [] : items.slice(start, start + params.pageSize);

  return {
    data,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1,
    },
  };
}

/** Builds the standard 400 response body for a `PaginationParseError`. */
export function paginationErrorResponse(
  err: PaginationParseError,
  correlationId?: string,
): Response {
  return fail(
    'VALIDATION_ERROR',
    err.message,
    { field: err.field, value: err.value },
    400,
    correlationId,
  );
}
