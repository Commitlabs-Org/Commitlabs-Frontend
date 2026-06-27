'use server';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { marketplaceService } from '@/lib/backend/services/marketplace';
import { MarketplaceListingDetail } from '@/components/MarketplaceListingDetail';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const listing = await marketplaceService.getPublicListing(params.id);

  if (!listing) {
    return {
      title: 'Listing not found — CommitLabs',
      description:
        'The requested marketplace listing could not be found. Verify the URL and try again.',
    };
  }

  return {
    title: `${listing.type} Listing ${listing.listingId} — CommitLabs`,
    description: `View the full trust, risk, and marketplace details for listing ${listing.listingId}.`,
    openGraph: {
      title: `${listing.type} Listing ${listing.listingId} — CommitLabs`,
      description: `Explore trust signals, seller reputation, and buy options for listing ${listing.listingId}.`,
      url: `https://commitlabs.com/marketplace/${listing.listingId}`,
    },
  };
}

export default async function MarketplaceListingPage({
  params,
}: {
  params: { id: string };
}) {
  const listing = await marketplaceService.getPublicListing(params.id);

  if (!listing) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-white/50">Marketplace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Listing {listing.listingId}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              A deep-linkable view for marketplace commitments, with seller trust
              signals, risk summaries, and purchase flow wiring.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
          >
            Back to marketplace
          </Link>
        </div>

        <MarketplaceListingDetail listing={listing} />
      </div>
    </main>
  );
}
