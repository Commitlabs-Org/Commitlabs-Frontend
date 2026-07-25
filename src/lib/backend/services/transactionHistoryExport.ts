/**
 * Transaction history export service.
 *
 * Provides export functionality for transaction history in JSON and CSV formats
 * with multi-field filtering (date range, type, asset, amount range).
 */

import { buildCsv } from '@/lib/backend/csv';
import { getCommitmentHistory } from '@/lib/backend/services/commitmentHistory';
import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';
import type { HistoryEvent } from '@/lib/types/domain';

export interface Transaction {
  id: string;
  timestamp: string;
  type: string;
  asset: string;
  amount: string | number;
  status?: string;
  txHash?: string;
  commitmentId?: string;
  ownerAddress?: string;
  details?: Record<string, unknown> | string;
}

export interface DateRangeFilter {
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface AmountRangeFilter {
  minAmount?: number;
  maxAmount?: number;
}

export type ExportFormat = 'JSON' | 'CSV' | 'json' | 'csv';

export interface ExportTransactionHistoryOptions {
  /** Output format: 'JSON' or 'CSV' (case-insensitive) */
  format: ExportFormat;
  /** Filter transactions within date range [startDate, endDate] (inclusive) */
  dateRange?: DateRangeFilter;
  /** Filter by transaction type or list of types (case-insensitive) */
  type?: string | string[];
  /** Filter by asset symbol or list of assets (case-insensitive) */
  asset?: string | string[];
  /** Filter by amount range [minAmount, maxAmount] */
  amountRange?: AmountRangeFilter;
  /** Stellar wallet/owner address to fetch transactions via query infrastructure */
  ownerAddress?: string;
  /** Direct transaction array to export/filter */
  transactions?: Transaction[];
}

export const TRANSACTION_EXPORT_CSV_HEADERS = [
  'Transaction ID',
  'Date',
  'Type',
  'Asset',
  'Amount',
  'Status',
  'Tx Hash',
  'Commitment ID',
] as const;

/**
 * Maps a commitment lifecycle HistoryEvent to a standardized Transaction object.
 */

export function mapHistoryEventToTransaction(
  event: HistoryEvent,
  commitment: {
    id: string;
    ownerAddress: string;
    asset: string;
    amount: string;
    status: string;
  },
): Transaction {
  let asset = commitment.asset;
  let amount: string | number = commitment.amount;
  let eventType: string = event.kind;

  if (event.kind === 'created') {
    asset = event.payload.asset || asset;
    amount = event.payload.amount || amount;
  } else if (event.kind === 'attestation') {
    eventType = event.payload.attestationType || event.kind;
  } else if (event.kind === 'early_exit') {
    amount = event.payload.penaltyAmount ?? amount;
  } else if (event.kind === 'settlement') {
    amount = event.payload.settlementAmount ?? amount;
  }

  return {
    id: event.eventId,
    timestamp: event.occurredAt,
    type: eventType,
    asset,
    amount,
    status: commitment.status,
    txHash: event.txHash,
    commitmentId: commitment.id,
    ownerAddress: commitment.ownerAddress,
  };
}

/**
 * Queries transactions for a given owner address using existing commitment and history infrastructure.
 */
export async function fetchTransactionsForOwner(
  ownerAddress: string,
): Promise<Transaction[]> {
  const commitments = await getUserCommitmentsFromChain(ownerAddress);
  const transactions: Transaction[] = [];

  for (const commitment of commitments) {
    try {
      const history = await getCommitmentHistory(commitment);
      if (history.events && history.events.length > 0) {
        for (const event of history.events) {
          transactions.push(mapHistoryEventToTransaction(event, commitment));
        }
      } else {
        transactions.push({
          id: commitment.id,
          timestamp: commitment.createdAt ?? new Date().toISOString(),
          type: commitment.status,
          asset: commitment.asset,
          amount: commitment.amount,
          status: commitment.status,
          commitmentId: commitment.id,
          ownerAddress: commitment.ownerAddress,
        });
      }
    } catch {
      transactions.push({
        id: commitment.id,
        timestamp: commitment.createdAt ?? new Date().toISOString(),
        type: commitment.status,
        asset: commitment.asset,
        amount: commitment.amount,
        status: commitment.status,
        commitmentId: commitment.id,
        ownerAddress: commitment.ownerAddress,
      });
    }
  }

  return transactions;
}

/**
 * Filters an array of transactions according to date range, type, asset, and amount criteria.
 */
export function filterTransactions(
  transactions: Transaction[],
  filters: {
    dateRange?: DateRangeFilter;
    type?: string | string[];
    asset?: string | string[];
    amountRange?: AmountRangeFilter;
  },
): Transaction[] {
  const { dateRange, type, asset, amountRange } = filters;

  const startMs = dateRange?.startDate
    ? new Date(dateRange.startDate).getTime()
    : null;
  const endMs = dateRange?.endDate
    ? new Date(dateRange.endDate).getTime()
    : null;

  const typesToMatch = type
    ? (Array.isArray(type) ? type : [type]).map((t) =>
        String(t).trim().toLowerCase(),
      )
    : null;

  const assetsToMatch = asset
    ? (Array.isArray(asset) ? asset : [asset]).map((a) =>
        String(a).trim().toLowerCase(),
      )
    : null;

  return transactions.filter((tx) => {
    // 1. Date range filter
    if (startMs !== null && !isNaN(startMs)) {
      const txMs = new Date(tx.timestamp).getTime();
      if (isNaN(txMs) || txMs < startMs) return false;
    }
    if (endMs !== null && !isNaN(endMs)) {
      const txMs = new Date(tx.timestamp).getTime();
      if (isNaN(txMs) || txMs > endMs) return false;
    }

    // 2. Type filter
    if (typesToMatch && typesToMatch.length > 0) {
      const txTypeLower = String(tx.type ?? '')
        .trim()
        .toLowerCase();
      if (!typesToMatch.includes(txTypeLower)) return false;
    }

    // 3. Asset filter
    if (assetsToMatch && assetsToMatch.length > 0) {
      const txAssetLower = String(tx.asset ?? '')
        .trim()
        .toLowerCase();
      if (!assetsToMatch.includes(txAssetLower)) return false;
    }

    // 4. Amount range filter
    if (amountRange) {
      const { minAmount, maxAmount } = amountRange;
      const rawAmountStr = String(tx.amount ?? '').replace(/,/g, '');
      const parsedAmount = parseFloat(rawAmountStr);

      if (typeof minAmount === 'number' && !isNaN(minAmount)) {
        if (isNaN(parsedAmount) || parsedAmount < minAmount) return false;
      }
      if (typeof maxAmount === 'number' && !isNaN(maxAmount)) {
        if (isNaN(parsedAmount) || parsedAmount > maxAmount) return false;
      }
    }

    return true;
  });
}

/**
 * Exports transaction history matching options into JSON or CSV string format.
 *
 * @param options Export and filtering configuration options
 * @returns Formatted JSON or CSV string
 */
export async function exportTransactionHistory(
  options: ExportTransactionHistoryOptions,
): Promise<string> {
  const {
    format,
    dateRange,
    type,
    asset,
    amountRange,
    ownerAddress,
    transactions: initialTransactions,
  } = options;

  if (!format || !['JSON', 'CSV'].includes(String(format).toUpperCase())) {
    throw new Error(
      `Unsupported export format: ${format}. Supported formats are 'JSON' and 'CSV'.`,
    );
  }

  let txList: Transaction[] = [];

  if (initialTransactions && Array.isArray(initialTransactions)) {
    txList = initialTransactions;
  } else if (ownerAddress) {
    txList = await fetchTransactionsForOwner(ownerAddress);
  }

  const filtered = filterTransactions(txList, {
    dateRange,
    type,
    asset,
    amountRange,
  });

  const normalizedFormat = String(format).toUpperCase() as 'JSON' | 'CSV';

  if (normalizedFormat === 'JSON') {
    return JSON.stringify(filtered, null, 2);
  }

  const rows = filtered.map((tx) => [
    tx.id ?? '',
    tx.timestamp ?? '',
    tx.type ?? '',
    tx.asset ?? '',
    tx.amount != null ? String(tx.amount) : '',
    tx.status ?? '',
    tx.txHash ?? '',
    tx.commitmentId ?? '',
  ]);

  return buildCsv([...TRANSACTION_EXPORT_CSV_HEADERS], rows);
}
