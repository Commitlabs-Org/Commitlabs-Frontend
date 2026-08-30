'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettlementEligibilityChecklistProps {
  commitmentId: string;
  onSettle?: () => void;
  disabledReason?: string;
  refreshTrigger?: string | number;
}

/** Bound: maximum polling attempts for eligibility check. */
const MAX_ELIGIBILITY_POLL_ATTEMPTS = 3;
/** Bound: minimum ms between eligibility re-checks. */
const ELIGIBILITY_DEDUP_MS = 5_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettlementEligibilityChecklist({
  commitmentId,
  onSettle,
  disabledReason,
  refreshTrigger,
}: SettlementEligibilityChecklistProps) {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [estimatedSettlement, setEstimatedSettlement] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);
  const attemptRef = useRef(0);

  const fetchEligibility = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < ELIGIBILITY_DEDUP_MS) return;
    if (attemptRef.current >= MAX_ELIGIBILITY_POLL_ATTEMPTS) return;
    lastFetchRef.current = now;
    attemptRef.current += 1;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/commitments/${encodeURIComponent(commitmentId)}/settlement/eligibility`,
        { credentials: 'include', headers: { Accept: 'application/json' } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEligible(Boolean(data?.eligible));
      setReason(data?.reason ?? null);
      setEstimatedSettlement(data?.estimatedSettlement ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check eligibility');
      setEligible(false);
    } finally {
      setLoading(false);
    }
  }, [commitmentId]);

  useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility, refreshTrigger]);

  return (
    <div
      className="bg-[#0a0a0a] rounded-2xl p-6 border border-[#222]"
      role="region"
      aria-label="Settlement eligibility"
    >
      <h3 className="text-white text-base font-semibold mb-4">Settlement preview</h3>

      {loading && (
        <div className="text-white/50 text-sm" role="status">
          Checking eligibility…
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && eligible !== null && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${eligible ? 'bg-green-500' : 'bg-yellow-500'}`}
            />
            <span className="text-white">
              {eligible ? 'Eligible for settlement' : 'Not yet eligible'}
            </span>
          </div>
          {reason && <p className="text-white/50 ml-5">{reason}</p>}
          {estimatedSettlement && (
            <p className="text-white/50 ml-5">
              Estimated settlement: {estimatedSettlement}
            </p>
          )}
        </div>
      )}

      {onSettle && (
        <button
          onClick={onSettle}
          disabled={!eligible || loading}
          className="mt-4 w-full rounded-xl px-4 py-3 bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-sm font-medium hover:bg-[#22c55e]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Settle commitment"
        >
          Settle
        </button>
      )}

      {disabledReason && (
        <p className="mt-3 text-white/40 text-xs" role="note">
          {disabledReason}
        </p>
      )}
    </div>
  );
}


