'use client';

import Link from 'next/link';
import { History } from 'lucide-react';

export interface RecentlyViewedCommitmentEntry {
  id: string;
  type: string;
  durationDays: number;
}

export interface RecentlyViewedCommitmentsRailProps {
  entries: RecentlyViewedCommitmentEntry[];
}

/**
 * Sidebar rail listing other commitments the user has recently viewed,
 * excluding the one currently on screen. Renders nothing when there are no
 * other entries to show, so it never adds an empty section to the page.
 */
export function RecentlyViewedCommitmentsRail({ entries }: RecentlyViewedCommitmentsRailProps) {
  if (entries.length === 0) return null;

  return (
    <nav
      aria-label="Recently viewed commitments"
      className="bg-[#0a0a0a] rounded-2xl p-6 border border-[#222]"
      data-testid="recently-viewed-commitments-rail"
    >
      <div className="flex items-center gap-2 mb-4 text-[#999]">
        <History size={16} />
        <h2 className="text-sm font-semibold uppercase tracking-wide">Recently Viewed</h2>
      </div>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={`/commitments/${entry.id}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[#ccc] hover:bg-[#151515] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ff0fc]"
            >
              <span>{entry.type} Commitment</span>
              <span className="text-xs text-[#666]">{entry.durationDays}d</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default RecentlyViewedCommitmentsRail;
