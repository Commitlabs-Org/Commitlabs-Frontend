'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Commitment } from '@/types/commitment';
import {
  readRecentlyViewedCommitmentIds,
  RECENTLY_VIEWED_COMMITMENTS_KEY,
  RECENTLY_VIEWED_COMMITMENTS_LIMIT,
} from '@/lib/recentlyViewedCommitments';

interface RecentlyViewedCommitmentsProps {
  commitments: Commitment[];
  maxItems?: number;
}

export default function RecentlyViewedCommitments({
  commitments,
  maxItems = RECENTLY_VIEWED_COMMITMENTS_LIMIT,
}: RecentlyViewedCommitmentsProps) {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    const refreshRecentIds = () => setRecentIds(readRecentlyViewedCommitmentIds());

    refreshRecentIds();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === RECENTLY_VIEWED_COMMITMENTS_KEY) {
        refreshRecentIds();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const commitmentsById = useMemo(() => {
    return new Map(commitments.map((commitment) => [commitment.id, commitment]));
  }, [commitments]);

  const recentCommitments = useMemo(() => {
    return recentIds
      .map((id) => commitmentsById.get(id))
      .filter((commitment): commitment is Commitment => Boolean(commitment))
      .slice(0, maxItems);
  }, [commitmentsById, maxItems, recentIds]);

  if (recentCommitments.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="recently-viewed-commitments-title"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-lg shadow-black/20"
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            Quick return
          </p>
          <h2
            id="recently-viewed-commitments-title"
            className="text-lg font-semibold text-white"
          >
            Recently viewed commitments
          </h2>
        </div>
        <p className="text-sm text-slate-400">
          Stored locally on this device.
        </p>
      </div>

      <div
        role="list"
        aria-label="Recently viewed commitment shortcuts"
        className="flex gap-3 overflow-x-auto pb-1"
      >
        {recentCommitments.map((commitment) => (
          <div key={commitment.id} role="listitem" className="min-w-[220px]">
            <Link
              href={`/commitments/${encodeURIComponent(commitment.id)}`}
              aria-label={`Open commitment ${commitment.id}`}
              className="block rounded-xl border border-white/10 bg-[#101217] p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-400/60 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#050505]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-sm font-semibold text-white">
                  {commitment.id}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-300">
                  {commitment.status}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">{commitment.type}</span>
                <span className="font-semibold text-blue-200">
                  {commitment.currentValue} {commitment.asset}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {commitment.daysRemaining > 0
                  ? `${commitment.daysRemaining} days remaining`
                  : 'Completed commitment'}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
