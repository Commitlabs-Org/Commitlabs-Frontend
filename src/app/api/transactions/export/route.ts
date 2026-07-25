import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/backend/auth';
import {
  BadRequestError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { exportTransactionHistory, ExportFormat } from '@/lib/backend/services/transactionHistoryExport';
import { withApiHandler } from '@/lib/backend/withApiHandler';

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
  const isAllowed = await checkRateLimit(ip, 'api/transactions/export');

  if (!isAllowed) {
    throw new TooManyRequestsError();
  }

  const token = getBearerToken(req);
  const session = verifySessionToken(token);

  if (!session.valid || !session.address) {
    throw new UnauthorizedError();
  }

  const url = new URL(req.url);
  const ownerAddress = url.searchParams.get('ownerAddress');
  if (!ownerAddress) {
    throw new BadRequestError('ownerAddress is required.');
  }

  if (normalizeAddress(session.address) !== normalizeAddress(ownerAddress)) {
    throw new ForbiddenError();
  }

  const formatParam = (url.searchParams.get('format') ?? 'csv').toLowerCase();
  if (formatParam !== 'csv' && formatParam !== 'json') {
    throw new BadRequestError("Invalid format parameter. Must be 'csv' or 'json'.");
  }
  const format: ExportFormat = formatParam as ExportFormat;

  const startDate = url.searchParams.get('startDate') ?? undefined;
  const endDate = url.searchParams.get('endDate') ?? undefined;

  const rawType = url.searchParams.get('type');
  const type = rawType ? rawType.split(',').map((t) => t.trim()) : undefined;

  const rawAsset = url.searchParams.get('asset');
  const asset = rawAsset ? rawAsset.split(',').map((a) => a.trim()) : undefined;

  const minAmountStr = url.searchParams.get('minAmount');
  const maxAmountStr = url.searchParams.get('maxAmount');
  const minAmount = minAmountStr != null && !isNaN(Number(minAmountStr)) ? Number(minAmountStr) : undefined;
  const maxAmount = maxAmountStr != null && !isNaN(Number(maxAmountStr)) ? Number(maxAmountStr) : undefined;

  const exportedData = await exportTransactionHistory({
    format,
    ownerAddress,
    dateRange: { startDate, endDate },
    type,
    asset,
    amountRange: { minAmount, maxAmount },
  });

  const isCsv = format === 'csv';
  const contentType = isCsv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8';
  const filename = isCsv ? 'transactions.csv' : 'transactions.json';

  return new NextResponse(exportedData, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
