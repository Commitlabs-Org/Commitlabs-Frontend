import { memo } from 'react';

export type CommitmentType = 'Safe' | 'Balanced' | 'Aggressive';

export interface MarketplaceCardProps {
  id: string;
  type: CommitmentType;
  score: number;
  amount: string;
  duration: string;
  yield: string;
  maxLoss: string;
  price: string;
  owner?: string;
  forSale?: boolean;
  compareSelected?: boolean;
  compareDisabled?: boolean;
  onCompareToggle?: () => void;
  onView?: (id: string) => void;
}

function assertValidCardProps(props: {
  id: string;
  type: CommitmentType;
  score: number;
  amount: string;
  duration: string;
  yield: string;
  maxLoss: string;
  price: string;
}): void {
  if (!props.id || typeof props.id !== 'string') {
    throw new Error('Invalid MarketplaceCardProps: id must be a non-empty string');
  }
  if (!['Safe', 'Balanced', 'Aggressive'].includes(props.type)) {
    throw new Error('Invalid MarketplaceCardProps: type must be Safe, Balanced, or Aggressive');
  }
  if (typeof props.score !== 'number' || Number.isNaN(props.score)) {
    throw new Error('Invalid MarketplaceCardProps: score must be a valid number');
  }
}

function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

const typeColorClass: Record<CommitmentType, string> = {
  Safe: 'text-[#00C950]',
  Balanced: 'text-[#51A2FF]',
  Aggressive: 'text-[#FF8904]',
};

const MarketplaceCardComponent = memo(function MarketplaceCard({
  id,
  type,
  score,
  amount,
  duration,
  yield: apy,
  maxLoss,
  price,
  owner,
  forSale = true,
  compareSelected = false,
  compareDisabled = false,
  onCompareToggle,
  onView,
}: MarketplaceCardProps) {
  assertValidCardProps({ id, type, score, amount, duration, yield: apy, maxLoss, price });

  const clampedScore = clampScore(score);

  return (
    <article
      className="flex flex-col h-full rounded-[14px] p-[18px] bg-[#0A0A0AE5] border border-[rgba(255,255,255,0.08)] transition-transform duration-180 ease-[ease]"
      aria-label={`Commitment ${id}`}
    >
      <header className="flex items-center justify-between gap-3.5 mb-3.5">
        <div
          className="w-[52px] h-[52px] rounded-[14px] grid place-items-center bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,rgba(0,0,0,0)_100%)] border border-[#FFFFFF33]"
          aria-hidden="true"
        >
          <span className={`text-xs font-bold ${typeColorClass[type]}`}>{type}</span>
        </div>
        <div className="flex flex-col items-end gap-2">
          {onCompareToggle && (
            <button
              type="button"
              className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-colors ${
                compareSelected
                  ? 'border-[#0FF0FC]/50 bg-[#0FF0FC]/15 text-[#0FF0FC]'
                  : compareDisabled
                    ? 'border-white/10 bg-white/[0.02] text-white/30 cursor-not-allowed'
                    : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]'
              }`}
              onClick={onCompareToggle}
              disabled={compareDisabled && !compareSelected}
              aria-pressed={compareSelected}
            >
              {compareSelected ? 'Comparing' : 'Compare'}
            </button>
          )}
          <span className={`text-[12px] tracking-[0.02em] font-[650] px-3 py-2 rounded-full bg-white/5 border border-white/10`}>
            {clampedScore}%
          </span>
        </div>
      </header>

      <div className="flex-1 pt-[10px] px-[2px] pb-0">
        <div className="font-mono text-[13px] text-white/65 mb-3">
          #{id}
        </div>

        <dl className="grid gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-white/60 text-[14px]">Amount</dt>
            <dd className="m-0 text-[15px] font-[650] text-white/90">{amount}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-white/60 text-[14px]">Duration</dt>
            <dd className="m-0 text-[15px] font-[650] text-white/90">{duration}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-white/60 text-[14px]">Yield</dt>
            <dd className="m-0 text-[15px] font-[650] text-[#0FF0FC]">{apy}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-white/60 text-[14px]">Max Loss</dt>
            <dd className="m-0 text-[15px] font-[650] text-white/90">{maxLoss}</dd>
          </div>
          {owner && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/60 text-[14px]">Owner</dt>
              <dd className="m-0 text-[15px] font-mono font-semibold text-white/80">{owner}</dd>
            </div>
          )}
        </dl>
      </div>

      <footer className="mt-4 pt-4 border-t border-white/10">
        {forSale ? (
          <div className="rounded-[14px] px-[14px] py-[14px] bg-[#0FF0FC0D] border border-[#0FF0FC33] text-center mb-3">
            <div className="text-[12px] text-white/55 mb-1.5">Price</div>
            <div className="text-[24px] font-[780] tracking-[0.02em] text-white">{price}</div>
          </div>
        ) : (
          <div
            className="h-12 rounded-[14px] inline-flex items-center justify-center gap-2.5 font-[650] tracking-[0.01em] select-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.10)] text-white/45 mb-3"
            aria-disabled="true"
          >
            Not for sale
          </div>
        )}
        <button
          type="button"
          className="focus-ring h-11 w-full rounded-[14px] inline-flex items-center justify-center gap-2.5 font-[650] tracking-[0.01em] select-none border border-[rgba(255,255,255,0.16)] text-white/90 bg-[rgba(255,255,255,0.04)] transition-colors duration-[160ms] hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.22)]"
          onClick={() => onView?.(id)}
          aria-label={`View ${id}`}
        >
          View
        </button>
      </footer>
    </article>
  );
});

export const MarketplaceCard = memo(MarketplaceCardComponent);
