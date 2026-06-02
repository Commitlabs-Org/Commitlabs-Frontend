'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock3, FileSearch, RotateCcw, X } from 'lucide-react';

export type SettlementModalState = 'ineligible' | 'settled';

type SettlementReasonCategory = 'not_matured' | 'already_settled' | 'disputed' | 'early_exit' | 'unknown';

export interface SettlementModalProps {
  isOpen: boolean;
  commitmentId: string;
  state: SettlementModalState;
  ineligibleReason?: string;
  settlementAmount?: string;
  onReturnToDashboard: () => void;
  onClose?: () => void;
}

interface IneligibleReasonCopy {
  category: SettlementReasonCategory;
  tone: 'temporary' | 'terminal' | 'unknown';
  badge: string;
  title: string;
  message: string;
  ctaLabel: string;
}

const UNKNOWN_REASON_COPY: IneligibleReasonCopy = {
  category: 'unknown',
  tone: 'unknown',
  badge: 'Review required',
  title: 'Settlement is unavailable',
  message:
    'We could not match this settlement response to a known reason. Review the commitment details before trying again.',
  ctaLabel: 'Review commitment details',
};

export function getSettlementIneligibleReasonCopy(reason?: string): IneligibleReasonCopy {
  const normalizedReason = reason?.toLowerCase().trim() ?? '';

  if (normalizedReason.includes('not matured') || normalizedReason.includes('matured yet')) {
    return {
      category: 'not_matured',
      tone: 'temporary',
      badge: 'Temporary blocker',
      title: 'Commitment has not matured yet',
      message:
        'This commitment is still active. Return after the maturity date, then retry settlement from the commitment details page.',
      ctaLabel: 'View maturity details',
    };
  }

  if (normalizedReason.includes('already been settled') || normalizedReason.includes('already settled')) {
    return {
      category: 'already_settled',
      tone: 'terminal',
      badge: 'Terminal state',
      title: 'Commitment is already settled',
      message:
        'This commitment has already completed settlement. Review the final settlement record from the commitment details page.',
      ctaLabel: 'View settlement details',
    };
  }

  if (
    normalizedReason.includes('violated') ||
    normalizedReason.includes('disputed') ||
    normalizedReason.includes('cannot be settled')
  ) {
    return {
      category: 'disputed',
      tone: 'terminal',
      badge: 'Terminal state',
      title: 'Commitment is disputed',
      message:
        'This commitment has a dispute or violation state that prevents settlement. Review the commitment details for next steps.',
      ctaLabel: 'Review dispute details',
    };
  }

  if (normalizedReason.includes('early') && normalizedReason.includes('exit')) {
    return {
      category: 'early_exit',
      tone: 'terminal',
      badge: 'Terminal state',
      title: 'Commitment was exited early',
      message:
        'This commitment has already been closed through early exit and cannot be settled again.',
      ctaLabel: 'Review exit details',
    };
  }

  return UNKNOWN_REASON_COPY;
}

function getToneClasses(tone: IneligibleReasonCopy['tone']) {
  if (tone === 'temporary') {
    return {
      border: 'border-[#0FF0FC]/30',
      bg: 'bg-[#0FF0FC]/10',
      text: 'text-[#0FF0FC]',
      icon: Clock3,
    };
  }

  if (tone === 'terminal') {
    return {
      border: 'border-[#FF8A04]/30',
      bg: 'bg-[#FF8A04]/10',
      text: 'text-[#FF8A04]',
      icon: AlertTriangle,
    };
  }

  return {
    border: 'border-white/15',
    bg: 'bg-white/[0.04]',
    text: 'text-white/80',
    icon: FileSearch,
  };
}

export default function SettlementModal({
  isOpen,
  commitmentId,
  state,
  ineligibleReason,
  settlementAmount,
  onReturnToDashboard,
  onClose,
}: SettlementModalProps) {
  if (!isOpen) return null;

  const detailsHref = `/commitments/${encodeURIComponent(commitmentId)}`;
  const reasonCopy = getSettlementIneligibleReasonCopy(ineligibleReason);
  const toneClasses = getToneClasses(reasonCopy.tone);
  const ReasonIcon = toneClasses.icon;
  const titleId = state === 'ineligible' ? 'settlement-ineligible-title' : 'settlement-success-title';
  const descriptionId =
    state === 'ineligible' ? 'settlement-ineligible-description' : 'settlement-success-description';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section className="w-full max-w-[560px] rounded-3xl border border-white/10 bg-[#0A0B0E] p-6 text-white shadow-[0_0_50px_rgba(15,240,252,0.12)] sm:p-8">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${toneClasses.border} ${toneClasses.bg}`}
            >
              {state === 'ineligible' ? (
                <ReasonIcon className={`h-7 w-7 ${toneClasses.text}`} aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-7 w-7 text-[#0FF0FC]" aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-white/45">Settlement</p>
              <h2 id={titleId} className="text-2xl font-bold leading-tight text-white">
                {state === 'ineligible' ? 'Settlement unavailable' : 'Settlement complete'}
              </h2>
            </div>
          </div>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Close settlement modal"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {state === 'ineligible' ? (
          <div className="space-y-6">
            <div
              className={`rounded-2xl border p-5 ${toneClasses.border} ${toneClasses.bg}`}
              role="alert"
              aria-live="polite"
              data-reason-category={reasonCopy.category}
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${toneClasses.border} ${toneClasses.text}`}>
                  {reasonCopy.badge}
                </span>
                <span className="text-xs font-medium text-white/55">
                  {reasonCopy.tone === 'temporary'
                    ? 'Temporary reason: action can be retried later.'
                    : reasonCopy.tone === 'terminal'
                      ? 'Terminal reason: settlement cannot be retried for this state.'
                      : 'Unknown reason: review before taking action.'}
                </span>
              </div>

              <h3 className="mb-2 text-lg font-bold text-white">{reasonCopy.title}</h3>
              <p id={descriptionId} className="text-sm leading-6 text-white/75">
                {reasonCopy.message}
              </p>

              {ineligibleReason ? (
                <p className="mt-4 rounded-xl bg-black/20 p-3 text-sm leading-6 text-white/70">
                  <span className="font-semibold text-white">Reason from settlement check: </span>
                  {ineligibleReason}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onReturnToDashboard}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-5 py-4 text-sm font-bold text-black transition hover:bg-[#7df8ff] active:scale-[0.99]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Return to dashboard
              </button>
              <Link
                href={detailsHref}
                className="flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center text-sm font-bold text-white transition hover:bg-white/10"
              >
                {reasonCopy.ctaLabel}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p id={descriptionId} className="text-sm leading-6 text-white/70">
              Settlement is complete and this commitment is now closed.
            </p>
            {settlementAmount ? (
              <div className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-white/45">Settlement amount</p>
                <p className="mt-2 text-2xl font-bold text-[#0FF0FC]">{settlementAmount}</p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onReturnToDashboard}
              className="w-full rounded-2xl bg-[#0FF0FC] px-5 py-4 text-sm font-bold text-black transition hover:bg-[#7df8ff] active:scale-[0.99]"
            >
              Return to dashboard
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
