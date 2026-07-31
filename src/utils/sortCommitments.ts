import { Commitment } from '@/types/commitment';

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
  if (typeof amount !== 'string') return 0;
  const parsed = Number(amount.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

function parseNumeric(val: unknown): number {
  if (val === undefined || val === null) return 0;
  const parsed = Number(val);
  return isNaN(parsed) ? 0 : parsed;
}

export function sortCommitments(commitments: Commitment[], sortBy: SortOption): Commitment[] {
  switch (sortBy) {
    case 'Newest':
      return [...commitments].sort(
        (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
      );
    case 'Oldest':
      return [...commitments].sort(
        (a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime(),
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
