'use client';

import React from 'react';
import MyCommitmentCard from './MyCommitmentCard';
import { Commitment } from '@/types/commitment';
import { EmptyState } from '@/components/ui/EmptyState';
import { useGridSelection } from '@/hooks/useGridSelection';
import { BulkActionBar } from './BulkActionBar';
import { Check } from 'lucide-react';

interface MyCommitmentsGridProps {
  commitments: Commitment[];
  onDetails?: (id: string) => void;
  onAttestations?: (id: string) => void;
  onEarlyExit?: (id: string) => void;
  onListForSale?: (id: string) => void;
  onExportSelected?: (selectedIds: string[]) => void;
  isExporting?: boolean;
}

const MyCommitmentsGrid: React.FC<MyCommitmentsGridProps> = ({
  commitments,
  onDetails,
  onAttestations,
  onEarlyExit,
  onListForSale,
  onExportSelected,
  isExporting = false,
}) => {
  const visibleIds = commitments.map(c => c.id);
  
  const {
    selectedIds,
    selectedCount,
    isAllSelected,
    isIndeterminate,
    toggleSelection,
    selectAll,
    clearSelection,
  } = useGridSelection({ visibleIds });

  const handleSelectAll = () => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  const handleExportSelected = () => {
    if (onExportSelected) {
      onExportSelected(Array.from(selectedIds));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header with select all control */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(input) => {
                if (input) {
                  input.indeterminate = isIndeterminate;
                }
              }}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#0FF0FC] focus:ring-2 focus:ring-[#0FF0FC] focus:ring-offset-0 focus:ring-offset-[#0a0a0a]"
              aria-label={isAllSelected ? 'Deselect all commitments' : 'Select all commitments'}
            />
            <span className="text-[14px] text-[#94A3B8]">
              <span className="text-[16px] font-semibold text-white">{commitments.length}</span>{' '}
              commitments found
            </span>
          </label>
        </div>
        
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-[#0FF0FC]">
            <Check size={16} />
            <span>{selectedCount} selected</span>
          </div>
        )}
      </div>
      
      {commitments.length > 0 ? (
        <div className="grid grid-cols-3 gap-6 max-[1200px]:grid-cols-2 max-[768px]:grid-cols-1">
          {commitments.map((commitment) => (
            <MyCommitmentCard
              key={commitment.id}
              commitment={commitment}
              isSelected={selectedIds.has(commitment.id)}
              onSelect={() => toggleSelection(commitment.id)}
              onDetails={onDetails}
              onAttestations={onAttestations}
              onEarlyExit={onEarlyExit}
              onListForSale={onListForSale}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No commitments found"
          description="No commitments found matching your filters."
          cta={{ label: 'Create your first commitment', href: '/create' }}
        />
      )}

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClear={clearSelection}
        onExportSelected={handleExportSelected}
        isExporting={isExporting}
      />
    </div>
  );
};

export default MyCommitmentsGrid;
