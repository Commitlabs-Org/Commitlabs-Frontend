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

const CSV_HEADERS = [
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
];

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
 * Lazily maps commitments to CSV rows. Using a generator avoids
 * materializing the full mapped array — the streamer pulls one row at a
 * time, so only a single row exists in memory between iterations.
 */
function* commitmentsToRows(commitments: Iterable<Commitment>): Generator<CsvRow> {
  for (const commitment of commitments) {
    yield [
      commitment.id,
      commitment.ownerAddress,
      commitment.asset,
      stringifyCsvValue(commitment.amount),
      commitment.status,
      stringifyCsvValue(commitment.complianceScore),
      stringifyCsvValue(commitment.currentValue),
      stringifyCsvValue(commitment.feeEarned),
      stringifyCsvValue(commitment.violationCount),
      stringifyCsvValue(commitment.createdAt),
      stringifyCsvValue(commitment.expiresAt),
    ];
  }
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

  const ownerAddress = new URL(req.url).searchParams.get('ownerAddress');
  if (!ownerAddress) {
    throw new BadRequestError('ownerAddress is required.');
  }

  if (normalizeAddress(session.address) !== normalizeAddress(ownerAddress)) {
    throw new ForbiddenError();
  }

  // Fetch happens before streaming starts so any failure here is caught by
  // `withApiHandler` and surfaced as a JSON error response, not a truncated
  // CSV. When `getUserCommitmentsFromChain` becomes streamable, swap the
  // generator argument for the async iterable directly.
  const commitments = await getUserCommitmentsFromChain(ownerAddress);
  const stream = createCsvStream(CSV_HEADERS, commitmentsToRows(commitments));

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="commitments.csv"',
      'Cache-Control': 'no-store',
    },
  });
});