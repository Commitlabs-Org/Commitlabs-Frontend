import React from 'react';
import { COVERAGE_WARNING_MESSAGE, isPayoutUncovered } from '@/lib/soroban/protocol-policy';

export interface YieldCoverageChipProps {
  accruedYield: bigint | number;
  yieldPool: bigint | number;
  className?: string;
}

export function YieldCoverageChip({
  accruedYield,
  yieldPool,
  className = '',
}: YieldCoverageChipProps) {
  if (!isPayoutUncovered(accruedYield, yieldPool)) {
    return null;
  }

  return (
    <div
      role="status"
      className={`coverage-warning-chip ${className}`}
      data-testid="yield-coverage-warning"
    >
      <span aria-hidden="true">&#9888;</span> {COVERAGE_WARNING_MESSAGE}
    </div>
  );
}
