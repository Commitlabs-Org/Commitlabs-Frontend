import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/backend/auth';
import { buildCsv } from '@/lib/backend/csv';
import {
  BadRequestError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';
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

  const commitments = await getUserCommitmentsFromChain(ownerAddress);
  const rows = commitments.map((commitment) => [
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
  ]);
  const csv = buildCsv(CSV_HEADERS, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="commitments.csv"',
    },
  });
});
