import { ValidationError } from '@lib/backend/errors';
import { MARKETPLACE_DEFAULT_PAGE_SIZE, MARKETPLACE_LISTING_ID_MAX_LENGTH, MARKETPLACE_MAX_PAGE, MARKETPLACE_MAX_PAGE_SIZE } from './constants';

const LISTING_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function parseOptionalNumber(searchParams: URLSearchParams, key: string): number | undefined {
  const raw = searchParams.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new ValidationError(`Invalid '${key}' query param. Expected a number.`);
  return parsed;
}

export function parsePositiveInteger(value: string | null, key: string, defaultValue: number): number {
  if (value === null) return defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new ValidationError(`Invalid '${key}' query param. Expected a positive integer.`);
  return parsed;
}

export function parseBoundedPagination(searchParams: URLSearchParams): { page: number; pageSize: number } {
  const page = parsePositiveInteger(searchParams.get('page'), 'page', 1);
  const pageSize = parsePositiveInteger(searchParams.get('pageSize'), 'pageSize', MARKETPLACE_DEFAULT_PAGE_SIZE);
  if (pageSize > MARKETPLACE_MAX_PAGE_SIZE) throw new ValidationError(`Invalid 'pageSize' query param. Maximum allowed is ${MARKETPLACE_MAX_PAGE_SIZE}.`);
  if (page > MARKETPLACE_MAX_PAGE) throw new ValidationError(`Invalid 'page' query param. Maximum allowed is ${MARKETPLACE_MAX_PAGE}.`);
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) throw new ValidationError('Pagination offset is too large.');
  return { page, pageSize };
}

export function validateListingId(raw: string): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) throw new ValidationError('Listing ID is required');
  const id = raw.trim();
  if (id.length > MARKETPLACE_LISTING_ID_MAX_LENGTH) throw new ValidationError(`Listing ID must be at most ${MARKETPLACE_LISTING_ID_MAX_LENGTH} characters.`);
  if (!LISTING_ID_PATTERN.test(id)) throw new ValidationError('Listing ID contains invalid characters. Only letters, digits, hyphens, and underscores are allowed.');
  return id;
}
