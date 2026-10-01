'use client';

export interface SavedListing {
  id: string;
  title: string;
  price: string;
  status?: 'Active' | 'Sold' | 'Cancelled';
}

export function SavedListingsRail({
  listings,
  savedIds,
  onRemove,
  onSelect,
}: {
  listings: SavedListing[];
  savedIds: ReadonlySet<string>;
  onRemove: (id: string) => void;
  onSelect?: (id: string) => void;
}) {
  const saved = listings.filter((listing) => savedIds.has(listing.id));
  if (saved.length === 0) return null;

  return (
    <section aria-label="Saved listings" className="mb-6 rounded-xl border border-white/10 p-4">
      <h2 className="mb-3 text-sm font-semibold text-white">Saved</h2>
      <ul className="flex gap-3 overflow-x-auto">
        {saved.map((listing) => (
          <li key={listing.id} className="min-w-44 rounded-lg bg-white/5 p-3 text-sm text-white">
            <button
              type="button"
              onClick={() => onSelect?.(listing.id)}
              className="block text-left"
            >
              <span className="block font-medium">{listing.title}</span>
              <span className="block text-white/60">{listing.price}</span>
              {listing.status && listing.status !== 'Active' && (
                <span className="block text-xs text-amber-300">{listing.status}</span>
              )}
            </button>
            <button
              type="button"
              aria-label={`Remove ${listing.title} from saved listings`}
              onClick={() => onRemove(listing.id)}
              className="mt-2 text-xs text-cyan-300 underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
