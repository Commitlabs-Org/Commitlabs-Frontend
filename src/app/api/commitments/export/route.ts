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
  type Commitment,
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
const HEADER_TO_FIELD: Record<CsvHeader, (c: Commitment) => unknown> = {
  'Commitment ID': (c) => c.id,
  'Owner': (c) => c.ownerAddress,
  'Asset': (c) => c.asset,
  'Amount': (c) => c.amount,
  'Status': (c) => c.status,
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
  commitments: Iterable<Commitment>,
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

  // Fetch happens before streaming starts so any failure here is caught by
  // `withApiHandler` and surfaced as a JSON error response, not a truncated
  // CSV. When `getUserCommitmentsFromChain` becomes streamable, swap the
  // generator argument for the async iterable directly.
  const commitments = await getUserCommitmentsFromChain(ownerAddress);
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