import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/backend/auth';
import { type CsvRow, createCsvStream } from '@/lib/backend/csv';
import {
  BadRequestError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
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

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
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

const SUPPORTED_EXPORT_FORMATS = ['csv'] as const;
type ExportFormat = (typeof SUPPORTED_EXPORT_FORMATS)[number];

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
  const ownerAddress = searchParams.get('ownerAddress');
  if (!ownerAddress) {
    throw new BadRequestError('ownerAddress is required.');
  }

  if (normalizeAddress(session.address) !== normalizeAddress(ownerAddress)) {
    throw new ForbiddenError();
  }

  const headers = resolveRequestedHeaders(searchParams.get('columns'));
  resolveExportFormat(searchParams.get('format'));
  const dateRange = resolveDateRange(searchParams.get('dateRange'));

  // Fetch happens before streaming starts so any failure here is caught by
  // `withApiHandler` and surfaced as a JSON error response, not a truncated
  // CSV. When `getUserCommitmentsFromChain` becomes streamable, swap the
  // generator argument for the async iterable directly.
  const commitments = filterByDateRange(await getUserCommitmentsFromChain(ownerAddress), dateRange);
  const stream = createCsvStream(headers, commitmentsToRows(commitments, headers));

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="commitments.csv"',
      'Cache-Control': 'no-store',
    },
  });
});
