'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';

interface SettlementEligibilityChecklistProps {
  commitmentId: string;
  onSettle?: () => void;
  disabledReason?: string;
  refreshTrigger?: string | number;
}

interface SettlementPreviewResponse {
  eligible: boolean;
  reason: string | null;
  estimatedSettlement: string | number | null;
}

interface ChecklistItem {
  id: 'maturity' | 'funded' | 'dispute' | 'status';
  label: string;
  description: string;
  isComplete: boolean;
}

function toDisplayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return String(value);
}

export function SettlementEligibilityChecklist({
  commitmentId,
  onSettle,
  disabledReason,
  refreshTrigger,
}: SettlementEligibilityChecklistProps) {
  const [preview, setPreview] = useState<SettlementPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPreview() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/commitments/${encodeURIComponent(commitmentId)}/settle/preview`);
        if (!response.ok) {
          throw new Error('Unable to verify settlement eligibility');
        }

        const payload = await response.json();
        if (isMounted) {
          setPreview(payload.data ?? payload);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to verify settlement eligibility');
          setPreview(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (commitmentId) {
      void fetchPreview();
    }

    return () => {
      isMounted = false;
    };
  }, [commitmentId, refreshTrigger]);

  const checklist = useMemo<ChecklistItem[]>(() => {
    if (!preview) {
      return [];
    }

    return [
      {
        id: 'maturity',
        label: 'Maturity reached',
        description: preview.eligible ? 'The commitment is mature enough to settle.' : preview.reason ?? 'Settlement is blocked until maturity.',
        isComplete: preview.eligible,
      },
      {
        id: 'dispute',
        label: 'No active dispute',
        description: preview.eligible ? 'No dispute is preventing settlement.' : preview.reason ?? 'Settlement is blocked by a dispute state.',
        isComplete: preview.eligible,
      },
      {
        id: 'status',
        label: 'Eligible settlement state',
        description: preview.eligible ? 'The commitment is in a settlement-ready state.' : preview.reason ?? 'The commitment is not in a settlement-ready state.',
        isComplete: preview.eligible,
      },
    ];
  }, [preview]);

  const statusLabel = preview?.eligible ? 'Eligible now' : 'Blocked';
  const statusTone = preview?.eligible ? 'text-[#0FF0FC]' : 'text-[#FF8A04]';
  const statusIcon = preview?.eligible ? CheckCircle2 : ShieldAlert;
  const StatusIcon = statusIcon;

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 text-white" aria-labelledby="settlement-eligibility-heading">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 id="settlement-eligibility-heading" className="text-sm font-semibold text-white">Settlement preview</h3>
          <p className="mt-1 text-xs text-white/60">Check eligibility before opening the settlement flow.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80">
          <StatusIcon className={`h-3.5 w-3.5 ${statusTone}`} aria-hidden="true" />
          <span>{isLoading ? 'Checking…' : statusLabel}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70" aria-live="polite">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
          Verifying settlement readiness…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#FF8A04]/30 bg-[#FF8A04]/10 p-3 text-sm text-white/80" role="alert">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Unable to verify settlement eligibility right now.</span>
          </div>
        </div>
      ) : (
        <>
          <ul className="space-y-2" aria-label="Settlement eligibility checklist">
            {checklist.map((item) => (
              <li key={item.id} className={`rounded-xl border p-3 ${item.isComplete ? 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="flex items-start gap-2">
                  {item.isComplete ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0FF0FC]" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8A04]" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-white/70">{item.description}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
            <p className="font-medium text-white">Estimated settlement</p>
            <p className="mt-1 text-xs leading-5">{toDisplayValue(preview?.estimatedSettlement ?? null)}</p>
          </div>

          {disabledReason ? (
            <p className="mt-3 text-xs leading-5 text-[#FF8A04]" role="note">{disabledReason}</p>
          ) : null}
        </>
      )}

      {onSettle ? (
        <button
          type="button"
          onClick={onSettle}
          disabled={!preview?.eligible}
          className="mt-4 w-full rounded-2xl bg-[#0FF0FC] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#7df8ff] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
          aria-label="Settle"
        >
          Settle
        </button>
      ) : null}
    </section>
  );
}
