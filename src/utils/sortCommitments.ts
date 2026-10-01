import { Commitment } from '@/types/commitment';

/** Supported sorting options for commitments. */
export type SortOption =
  | 'Newest'
  | 'Oldest'
  | 'ValueHighLow'
  | 'ValueLowHigh'
  | 'MaturitySoonest'
  | 'MaturityLatest'
  | 'ComplianceHighLow'
  | 'ComplianceLowHigh'
  | 'YieldHighLow'
  | 'YieldLowHigh';

function parseAmount(amount: unknown): number {
  if (typeof amount === 'number') {
    return isNaN(amount) ? 0 : amount;
  }
  if (typeof amount !== 'string') return 0;
  const parsed = Number(amount.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

function parseNumeric(val: unknown): number {
  if (val === undefined || val === null) return 0;
  const parsed = Number(val);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(val: unknown): number {
  if (typeof val !== 'string' && !(val instanceof Date) && typeof val !== 'number') return 0;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Sorts an array of commitments based on the specified sort option.
 * If an unrecognized sort option is provided, returns the input array unchanged.
 * Handles malformed numeric and date fields gracefully with defensive parsing.
 *
 * @param commitments - The array of commitments to sort.
 * @param sortBy - The criterion by which to sort the commitments.
 * @returns A new sorted array of commitments, or the original array if sortBy is unrecognized.
 */
export function sortCommitments(commitments: Commitment[], sortBy: SortOption): Commitment[] {
  switch (sortBy) {
    case 'Newest':
      return [...commitments].sort(
        (a, b) => parseDate(b.createdDate ?? b.createdAt) - parseDate(a.createdDate ?? a.createdAt),
      );
    case 'Oldest':
      return [...commitments].sort(
        (a, b) => parseDate(a.createdDate ?? a.createdAt) - parseDate(b.createdDate ?? b.createdAt),
      );
    case 'ValueHighLow':
      return [...commitments].sort((a, b) => parseAmount(b.amount) - parseAmount(a.amount));
    case 'ValueLowHigh':
      return [...commitments].sort((a, b) => parseAmount(a.amount) - parseAmount(b.amount));
    case 'MaturitySoonest':
      return [...commitments].sort(
        (a, b) => parseNumeric(a.daysRemaining) - parseNumeric(b.daysRemaining),
      );
    case 'MaturityLatest':
      return [...commitments].sort(
        (a, b) => parseNumeric(b.daysRemaining) - parseNumeric(a.daysRemaining),
      );
    case 'ComplianceHighLow':
      return [...commitments].sort(
        (a, b) => parseNumeric(b.complianceScore) - parseNumeric(a.complianceScore),
      );
    case 'ComplianceLowHigh':
      return [...commitments].sort(
        (a, b) => parseNumeric(a.complianceScore) - parseNumeric(b.complianceScore),
      );
    case 'YieldHighLow':
      return [...commitments].sort(
        (a, b) => parseNumeric(b.changePercent) - parseNumeric(a.changePercent),
      );
    case 'YieldLowHigh':
      return [...commitments].sort(
        (a, b) => parseNumeric(a.changePercent) - parseNumeric(b.changePercent),
      );
    default:
      return commitments;
  }
}
