'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { Commitment } from '@/types/commitment';

interface MyCommitmentCardProps {
  commitment: Commitment;
  isSelected?: boolean;
  onSelect?: () => void;
  onDetails?: (id: string) => void;
  onAttestations?: (id: string) => void;
  onEarlyExit?: (id: string) => void;
  onListForSale?: (id: string) => void;
}

/**
 * MyCommitmentCard
 *
 * Renders a single user-owned commitment in the grid.
 * Wrapped in React.memo so the card only re-renders when its own
 * props change — avoiding cascading re-renders when siblings are selected.
 */
const MyCommitmentCard: React.FC<MyCommitmentCardProps> = memo(
  ({
    commitment,
    isSelected = false,
    onSelect,
    onDetails,
    onAttestations,
    onEarlyExit,
    onListForSale,
  }) => {
    const {
      id,
      type,
      status,
      asset,
      amount,
      complianceScore,
      daysRemaining,
      currentValue,
      changePercent,
    } = commitment;

    const statusColour: Record<string, string> = {
      Active: 'text-emerald-400',
      Settled: 'text-blue-400',
      Violated: 'text-red-400',
      'Early Exit': 'text-amber-400',
    };

    const typeColour: Record<string, string> = {
      Safe: 'bg-emerald-500/10 text-emerald-400',
      Balanced: 'bg-amber-500/10 text-amber-400',
      Aggressive: 'bg-red-500/10 text-red-400',
    };

    return (
      <article
        className={[
          'relative flex flex-col gap-4 rounded-xl border p-5 transition-all',
          'bg-white/[0.03] hover:bg-white/[0.05]',
          isSelected
            ? 'border-[#0FF0FC]/50 ring-1 ring-[#0FF0FC]/30'
            : 'border-white/10 hover:border-white/20',
        ].join(' ')}
        aria-label={`Commitment ${id}`}
      >
        {/* Selection checkbox */}
        {onSelect && (
          <button
            onClick={onSelect}
            aria-pressed={isSelected}
            aria-label={isSelected ? `Deselect commitment ${id}` : `Select commitment ${id}`}
            className="absolute top-3 right-3 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
          >
            <span
              className={[
                'flex h-4 w-4 items-center justify-center rounded border',
                isSelected
                  ? 'border-[#0FF0FC] bg-[#0FF0FC]/20'
                  : 'border-white/20 bg-white/5',
              ].join(' ')}
            >
              {isSelected && (
                <svg className="h-3 w-3 text-[#0FF0FC]" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
          </button>
        )}

        {/* Header */}
        <div className="flex items-start justify-between pr-6">
          <div className="flex flex-col gap-1">
            <Link
              href={`/commitments/${id}`}
              className="text-[15px] font-semibold text-white hover:text-[#0FF0FC] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0FF0FC] rounded"
            >
              {id}
            </Link>
            <span className="text-[13px] text-[#94A3B8]">{asset}</span>
          </div>

          <span
            className={[
              'text-[11px] font-medium px-2 py-0.5 rounded-full',
              typeColour[type] ?? 'bg-white/5 text-white/60',
            ].join(' ')}
          >
            {type}
          </span>
        </div>

        {/* Metrics */}
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[11px] text-[#94A3B8] uppercase tracking-wide">Amount</dt>
            <dd className="text-[14px] font-semibold text-white mt-0.5">{amount}</dd>
          </div>

          {currentValue !== undefined && (
            <div>
              <dt className="text-[11px] text-[#94A3B8] uppercase tracking-wide">Value</dt>
              <dd className="text-[14px] font-semibold text-white mt-0.5">
                {currentValue}
                {changePercent !== undefined && (
                  <span
                    className={changePercent >= 0 ? 'text-emerald-400 text-[11px] ml-1' : 'text-red-400 text-[11px] ml-1'}
                  >
                    {changePercent >= 0 ? '+' : ''}
                    {changePercent.toFixed(2)}%
                  </span>
                )}
              </dd>
            </div>
          )}

          {complianceScore !== undefined && (
            <div>
              <dt className="text-[11px] text-[#94A3B8] uppercase tracking-wide">Compliance</dt>
              <dd className="text-[14px] font-semibold text-white mt-0.5">{complianceScore}%</dd>
            </div>
          )}

          {daysRemaining !== undefined && (
            <div>
              <dt className="text-[11px] text-[#94A3B8] uppercase tracking-wide">Days Left</dt>
              <dd className="text-[14px] font-semibold text-white mt-0.5">{daysRemaining}d</dd>
            </div>
          )}
        </dl>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span
            className={['text-[12px] font-medium', statusColour[status] ?? 'text-white/60'].join(
              ' ',
            )}
          >
            ● {status}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
          {onDetails && (
            <button
              onClick={() => onDetails(id)}
              className="text-[12px] text-[#94A3B8] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0FF0FC] rounded"
            >
              Details
            </button>
          )}
          {onAttestations && (
            <button
              onClick={() => onAttestations(id)}
              className="text-[12px] text-[#94A3B8] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0FF0FC] rounded"
            >
              Attestations
            </button>
          )}
          {onEarlyExit && status === 'Active' && (
            <button
              onClick={() => onEarlyExit(id)}
              className="text-[12px] text-amber-400 hover:text-amber-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded"
            >
              Early Exit
            </button>
          )}
          {onListForSale && status === 'Active' && (
            <button
              onClick={() => onListForSale(id)}
              className="text-[12px] text-[#0FF0FC] hover:text-[#0FF0FC]/80 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0FF0FC] rounded"
            >
              List for Sale
            </button>
          )}
        </div>
      </article>
    );
  },
);

MyCommitmentCard.displayName = 'MyCommitmentCard';

export default MyCommitmentCard;
