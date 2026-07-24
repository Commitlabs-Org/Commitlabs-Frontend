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

export function sortCommitments(commitments: Commitment[], sortBy: SortOption): Commitment[] {
  const sorted = [...commitments];

  switch (sortBy) {
    case 'Newest':
      sorted.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
      break;
    case 'Oldest':
      sorted.sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());
      break;
    case 'ValueHighLow':
      sorted.sort((a, b) => Number(b.amount.replace(/,/g, '')) - Number(a.amount.replace(/,/g, '')));
      break;
    case 'ValueLowHigh':
      sorted.sort((a, b) => Number(a.amount.replace(/,/g, '')) - Number(b.amount.replace(/,/g, '')));
      break;
    case 'MaturitySoonest':
      sorted.sort((a, b) => a.daysRemaining - b.daysRemaining);
      break;
    case 'MaturityLatest':
      sorted.sort((a, b) => b.daysRemaining - a.daysRemaining);
      break;
    case 'ComplianceHighLow':
      sorted.sort((a, b) => b.complianceScore - a.complianceScore);
      break;
    case 'ComplianceLowHigh':
      sorted.sort((a, b) => a.complianceScore - b.complianceScore);
      break;
    case 'YieldHighLow':
      sorted.sort((a, b) => b.changePercent - a.changePercent);
      break;
    case 'YieldLowHigh':
      sorted.sort((a, b) => a.changePercent - b.changePercent);
      break;
    default:
      break;
  }

  return sorted;
}
