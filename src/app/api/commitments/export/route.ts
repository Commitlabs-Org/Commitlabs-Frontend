/**
 * @file /api/commitments/export
 *
 * GET – Streams a CSV export of user commitments with optional filtering.
 *
 * Authorization
 * ──────────────
 * • Requires valid Bearer token identifying the authenticated wallet.
 * • The `ownerAddress` query param must match the authenticated wallet address.
 * • Mismatches or invalid tokens yield 401/403 errors before streaming.
 *
 * Request params
 * ──────────────
 * • ownerAddress (required): Wallet address requesting the export.
 * • columns (optional): Comma-separated header names to export. Unknown names dropped.
 * • format (optional): Export format ('csv' only, error on unsupported values).
 * • dateRange (optional): Filter range ('7d', '30d', 'year', 'all'). Defaults to 'all'.
 * • idempotency-key (optional): Idempotency key for safe retries.
 *   Same key within 24h returns cached result without re-fetching.
 *
 * State machine and invariants
 * ─────────────────────────────
 * • Authorization is checked synchronously before streaming starts.
 * • The row count is bounded (MAX_EXPORT_ROWS) to prevent unbounded CPU/memory.
 * • CSV values are escaped to prevent formula injection (leading =+-@).
 * • Response headers include no-store, private, nosniff to prevent caching leaks.
 * • On idempotency key replay within TTL, the cached response is returned
 *   without re-fetching from chain — preserving user intent across retries.
 * • On chain fetch error, errors surface as JSON (not truncated CSV).
 *
 * Retry and recovery
 * ──────────────────
 * • Network-level retries (5xx, timeouts) are safe with idempotency-key:
 *   same key within 24h returns the cached export.
 * • Client may retry on 429 (rate limit) after waiting Retry-After seconds.
 * • 400/403/401 errors are not retryable; client must fix the request.
 * • On chain fetch failure (502), the error surfaces as JSON.
 *
 * Non-goals
 * ─────────
 * • Streaming from chain: exports must fit in memory before streaming.
 * • Cancel/interrupt handling: client disconnects abort the response naturally.
 * • Multi-user coordination: each user's export is independent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/backend/auth';
import { type CsvRow, createCsvStream, formatCsvRow } from '@/lib/backend/csv';
import {
  BadRequestError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { idempotencyService } from '@/lib/backend/idempotency';
import {
  getUserCommitmentsFromChain,
  type ChainCommitment,
} from '@/lib/backend/services/contracts';
import { withApiHandler } from '@/lib/backend/withApiHandler';

const ALL_CSV_HEADERS = [
  'Commitment ID',
  'Owner',
  'Asset',
  'Amount',
  'Status',
  'Compliance Score',
  'Current Value',
  'Fee Earned',
  'Violation Count',
  'Created At',
  'Expires At',
] as const;

type CsvHeader = (typeof ALL_CSV_HEADERS)[number];

interface ExportCacheEntry {
  status: 'COMPLETED' | 'FAILED';
  response?: {
    body: string;
    statusCode: number;
    headers: Record<string, string>;
  };
}

/** Map each header label to the commitment field that supplies its value. */
const HEADER_TO_FIELD: Record<CsvHeader, (c: ChainCommitment) => unknown> = {
  'Commitment ID': (c) => c.id,
  Owner: (c) => c.ownerAddress,
  Asset: (c) => c.asset,
  Amount: (c) => c.amount,
  Status: (c) => c.status,
  'Compliance Score': (c) => c.complianceScore,
  'Current Value': (c) => c.currentValue,
  'Fee Earned': (c) => c.feeEarned,
  'Violation Count': (c) => c.violationCount,
  'Created At': (c) => c.createdAt,
  'Expires At': (c) => c.expiresAt,
};

function stringifyCsvValue(value: unknown): string {
  if (value == null) {
    return '';
  }

  return typeof value === 'bigint' ? value.toString() : String(value);
}

function getBearerToken(req: NextRequest): string {
  const authorizationHeader = req.headers.get('authorization');
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw new UnauthorizedError();
  }

  return match[1];
}

const MAX_EXPORT_ROWS = 5000;

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function isValidStellarAddressFormat(address: string): boolean {
  // Stellar public key format: starts with 'G', 56 chars total, base32 alphabet (A-Z, 2-7)
  const trimmed = address.trim();
  return /^G[A-Z2-7]{55}$/.test(trimmed);
}

function assertValidOwnerAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed || !isValidStellarAddressFormat(trimmed)) {
    throw new BadRequestError('ownerAddress must be a valid Stellar wallet address.');
  }
  return trimmed;
}

/**
 * Lazily maps commitments to CSV rows for only the requested headers.
 * Using a generator avoids materializing the full mapped array — the
 * streamer pulls one row at a time, so only a single row exists in memory
 * between iterations.
 */
function* commitmentsToRows(
  commitments: Iterable<ChainCommitment>,
  headers: readonly CsvHeader[],
): Generator<CsvRow> {
  for (const commitment of commitments) {
    yield headers.map((h) => stringifyCsvValue(HEADER_TO_FIELD[h](commitment)));
  }
}

/**
 * Parses and validates a comma-separated `columns` query param against the
 * known header list. Unknown values are silently dropped. Returns all headers
 * when the param is absent or empty.
 */
function resolveRequestedHeaders(columnsParam: string | null): CsvHeader[] {
  if (!columnsParam?.trim()) return [...ALL_CSV_HEADERS];

  const requested = columnsParam.split(',').map((c) => c.trim());
  const valid = requested.filter((c): c is CsvHeader =>
    (ALL_CSV_HEADERS as readonly string[]).includes(c),
  );
  return valid.length > 0 ? valid : [...ALL_CSV_HEADERS];
}

const _SUPPORTED_EXPORT_FORMATS = ['csv'] as const;
type ExportFormat = (typeof _SUPPORTED_EXPORT_FORMATS)[number];

/**
 * Only CSV is implemented server-side today. Any other value (e.g. the
 * "JSON soon" option surfaced but disabled in the UI) is rejected rather
 * than silently downgraded to CSV.
 */
function resolveExportFormat(formatParam: string | null): ExportFormat {
  if (!formatParam || formatParam === 'csv') return 'csv';

  throw new BadRequestError(`Unsupported export format: ${formatParam}. Only "csv" is available.`);
}

const DATE_RANGES = ['all', '7d', '30d', 'year'] as const;
type DateRange = (typeof DATE_RANGES)[number];

function resolveDateRange(dateRangeParam: string | null): DateRange {
  if (!dateRangeParam) return 'all';
  return (DATE_RANGES as readonly string[]).includes(dateRangeParam)
    ? (dateRangeParam as DateRange)
    : 'all';
}

/** Cutoff instant a commitment's `createdAt` must be on-or-after to match `range`. */
function dateRangeCutoff(range: DateRange, now: Date): Date | null {
  switch (range) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    case 'all':
      return null;
  }
}

/**
 * Filters commitments to those created on-or-after the range's cutoff.
 * Commitments with a missing/unparseable `createdAt` are excluded from any
 * range narrower than "all", since their membership can't be confirmed.
 */
function filterByDateRange(
  commitments: ChainCommitment[],
  range: DateRange,
  now: Date = new Date(),
): ChainCommitment[] {
  const cutoff = dateRangeCutoff(range, now);
  if (!cutoff) return commitments;

  return commitments.filter((c) => {
    if (!c.createdAt) return false;
    const createdAt = new Date(c.createdAt);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
  });
}

const RESPONSE_HEADERS = {
  'Content-Type': 'text/csv; charset=utf-8',
  'Content-Disposition':
    'attachment; filename="commitments.csv"; filename*=UTF-8\'\'commitments.csv',
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
};

export const GET = withApiHandler(async (req: NextRequest) => {
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
  const isAllowed = await checkRateLimit(ip, 'api/commitments/export');

  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const token = getBearerToken(req);
  const session = verifySessionToken(token);

  if (!session.valid || !session.address) {
    throw new UnauthorizedError();
  }

  const searchParams = new URL(req.url).searchParams;
  const rawOwnerAddress = searchParams.get('ownerAddress');
  const ownerAddress = rawOwnerAddress ? assertValidOwnerAddress(rawOwnerAddress) : null;

  if (!ownerAddress) {
    throw new BadRequestError('ownerAddress is required.');
  }

  if (normalizeAddress(session.address) !== normalizeAddress(ownerAddress)) {
    throw new ForbiddenError('The export owner does not match the authenticated wallet.');
  }

  // Idempotency: check for cached export on retry within 24h TTL.
  // Same key returns the cached response; different key forces re-fetch.
  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    const scopedKey = `export:${session.address}:${idempotencyKey}`;
    const cached = await idempotencyService.getRecord<ExportCacheEntry>(scopedKey);
    if (cached?.status === 'COMPLETED' && cached.response) {
      return new NextResponse(cached.response.body, {
        status: cached.response.statusCode || 200,
        headers: cached.response.headers,
      });
    }

    // Mark operation as started to prevent race conditions on concurrent requests
    const started = await idempotencyService.start(scopedKey);
    if (!started) {
      throw new BadRequestError(
        'Export already in progress with this idempotency key. Retry in a moment.',
      );
    }

    try {
      const headers = resolveRequestedHeaders(searchParams.get('columns'));
      resolveExportFormat(searchParams.get('format'));
      const dateRange = resolveDateRange(searchParams.get('dateRange'));

      const commitments = filterByDateRange(
        await getUserCommitmentsFromChain(ownerAddress),
        dateRange,
      );
      if (commitments.length > MAX_EXPORT_ROWS) {
        await idempotencyService.fail(scopedKey);
        throw new BadRequestError(
          `Export exceeds the maximum row limit of ${MAX_EXPORT_ROWS}. Narrow the date range and retry.`,
        );
      }

      // Buffer CSV for idempotent replay. Production system with very large
      // exports should swap this for a persistent blob store.
      const chunks: string[] = [];
      chunks.push(formatCsvRow(headers));
      for (const row of commitmentsToRows(commitments, headers)) {
        chunks.push(formatCsvRow(row));
      }
      const csvBody = chunks.join('');

      // Cache response for replay on retry
      const cacheEntry: ExportCacheEntry = {
        status: 'COMPLETED',
        response: {
          body: csvBody,
          statusCode: 200,
          headers: RESPONSE_HEADERS,
        },
      };
      await idempotencyService.complete<ExportCacheEntry>(scopedKey, cacheEntry, 200);

      return new NextResponse(csvBody, { status: 200, headers: RESPONSE_HEADERS });
    } catch (error) {
      await idempotencyService.fail(scopedKey);
      throw error;
    }
  }

  // No idempotency key: stream without caching. Retries will re-fetch.
  const headers = resolveRequestedHeaders(searchParams.get('columns'));
  resolveExportFormat(searchParams.get('format'));
  const dateRange = resolveDateRange(searchParams.get('dateRange'));

  const commitments = filterByDateRange(await getUserCommitmentsFromChain(ownerAddress), dateRange);
  if (commitments.length > MAX_EXPORT_ROWS) {
    throw new BadRequestError(
      `Export exceeds the maximum row limit of ${MAX_EXPORT_ROWS}. Narrow the date range and retry.`,
    );
  }

  const stream = createCsvStream(headers, commitmentsToRows(commitments, headers));

  return new NextResponse(stream, {
    status: 200,
    headers: RESPONSE_HEADERS,
  });
});
