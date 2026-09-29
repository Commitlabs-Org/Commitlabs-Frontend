import type { Commitment } from '@/types/commitment';

/**
 * Supported sort options for ordering commitments.
 */
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
  if (typeof amount !== 'string') {
    return 0;
  }
  const parsed = Number(amount.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

function parseNumeric(val: unknown): number {
  if (val === undefined || val === null) {
    return 0;
  }
  const parsed = Number(val);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(dateVal: unknown): number {
  if (typeof dateVal !== 'string') {
    return 0;
  }
  const timestamp = new Date(dateVal).getTime();
  return isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Sorts an array of commitments according to the specified sort option.
 * Returns a new sorted array without mutating the original input array.
 * If an unrecognized sort option is supplied, the original array is returned unchanged.
 *
 * @param commitments - The list of commitments to sort.
 * @param sortBy - The sort option to apply.
 * @returns A sorted copy of commitments, or the original array if sortBy is unrecognized.
 */
export function sortCommitments(commitments: Commitment[], sortBy: SortOption): Commitment[] {
  switch (sortBy) {
    case 'Newest':
      return [...commitments].sort((a, b) => parseDate(b.createdDate) - parseDate(a.createdDate));
    case 'Oldest':
      return [...commitments].sort((a, b) => parseDate(a.createdDate) - parseDate(b.createdDate));
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
