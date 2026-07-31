'use client';

export interface SellerListing {
  sellerAddress: string;
}

export function truncateSellerAddress(address: string, leading = 6, trailing = 4): string {
  if (address.length <= leading + trailing + 1) return address;
  return `${address.slice(0, leading)}…${address.slice(-trailing)}`;
}

export function filterListingsBySeller<T extends SellerListing>(
  listings: readonly T[],
  sellerQuery: string,
): T[] {
  const query = sellerQuery.trim().toLowerCase();
  if (!query) return [...listings];
  return listings.filter((listing) => listing.sellerAddress.toLowerCase().includes(query));
}

export function MarketplaceFilters({
  seller,
  onSellerChange,
  onClear,
}: {
  seller: string;
  onSellerChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div aria-label="Marketplace filters" className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-56 flex-col gap-1 text-sm text-white/70">
        Seller
        <input
          value={seller}
          onChange={(event) => onSellerChange(event.target.value)}
          placeholder="Search seller address"
          aria-label="Filter by seller"
          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-cyan-300"
        />
      </label>
      {seller.trim() && (
        <button type="button" onClick={onClear} className="text-sm text-cyan-300 underline">
          Clear seller filter
        </button>
      )}
    </div>
  );
}
