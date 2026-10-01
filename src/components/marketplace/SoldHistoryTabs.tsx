'use client';

import { useState, type ReactNode } from 'react';

export interface SoldHistoryListing {
  id: string;
  title: string;
  price: string;
  soldAt: string;
}

export function SoldHistoryTabs({
  active,
  sold,
  renderActive,
}: {
  active: ReactNode;
  sold: SoldHistoryListing[];
  renderActive?: ReactNode;
}) {
  const [tab, setTab] = useState<'active' | 'sold'>('active');

  return (
    <section aria-label="Marketplace history">
      <div role="tablist" aria-label="Marketplace listing status" className="mb-4 flex gap-2">
        {(['active', 'sold'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`marketplace-panel-${value}`}
            onClick={() => setTab(value)}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white"
          >
            {value === 'active' ? 'Active' : 'Sold history'}
          </button>
        ))}
      </div>

      {tab === 'active' ? (
        <div id="marketplace-panel-active" role="tabpanel">
          {renderActive ?? active}
        </div>
      ) : (
        <div id="marketplace-panel-sold" role="tabpanel">
          {sold.length === 0 ? (
            <p className="rounded-lg border border-white/10 p-6 text-white/60">
              No sold listings yet.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {sold.map((listing) => (
                <li key={listing.id} className="rounded-lg border border-white/10 p-4 text-white">
                  <span className="block font-medium">{listing.title}</span>
                  <span className="block text-white/70">Sale price: {listing.price}</span>
                  <time className="block text-sm text-white/50" dateTime={listing.soldAt}>
                    Sold {new Date(listing.soldAt).toLocaleDateString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
