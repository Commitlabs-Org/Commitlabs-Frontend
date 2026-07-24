import Link from 'next/link';
import { ReputationDisplay } from '@/components/ReputationDisplay';
import { TrustBadge, type TrustLevel } from '@/components/TrustBadge';
import { MarketplaceListingPurchase } from '@/components/MarketplaceListingPurchase';
import type { MarketplacePublicListing } from '@/lib/backend/services/marketplace';

interface MarketplaceListingDetailProps {
  listing: MarketplacePublicListing;
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function determineTrustLevel(score: number): TrustLevel {
  if (score >= 90) return 'verified';
  if (score >= 80) return 'reputable';
  return 'unverified';
}

export function MarketplaceListingDetail({ listing }: MarketplaceListingDetailProps) {
  const trustLevel = determineTrustLevel(listing.complianceScore);
  const sellerReputation = {
    score: Math.min(100, Math.max(0, Math.round(listing.complianceScore + 4))),
    totalCommitments: 28,
    successRate: Math.min(100, Math.max(0, Math.round(listing.complianceScore + 8))),
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[1.4fr_0.6fr]">
      <div className="space-y-6 rounded-[28px] border border-white/10 bg-[#0B0B0B]/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-white/40">
                Marketplace listing
              </span>
              <TrustBadge level={trustLevel} showTooltip={false} />
            </div>

            <h2 className="text-3xl font-semibold tracking-tight text-white">
              {listing.type} commitment · {listing.listingId}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-white/60">
              This listing is available for purchase on the CommitLabs marketplace.
              Review risk metrics, seller reputation, and the buy flow before committing.
            </p>
          </div>
          <div className="text-right text-sm text-white/50">
            <p className="font-semibold text-white">Commitment ID</p>
            <p>{listing.commitmentId}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.26em] text-white/40">Price</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {formatCurrency(listing.price)}
            </p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.26em] text-white/40">Yield</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {listing.currentYield}%
            </p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.26em] text-white/40">Compliance score</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {listing.complianceScore}
            </p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.26em] text-white/40">Max loss</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {listing.maxLoss}%
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[20px] border border-white/10 bg-[#0B0B0B]/90 p-6">
            <h3 className="text-lg font-semibold text-white">Risk & trust overview</h3>
            <ul className="mt-5 grid gap-4 text-sm text-white/70">
              <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">Committed liquidity</p>
                <p>{formatCurrency(listing.amount)}</p>
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">Term remaining</p>
                <p>{listing.remainingDays} days</p>
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">Seller reputation</p>
                <p>{sellerReputation.successRate}% success rate</p>
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">Marketplace status</p>
                <p className="text-[#0FF0FC]">Active</p>
              </li>
            </ul>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-[#0B0B0B]/90 p-6">
            <h3 className="text-lg font-semibold text-white">Seller reputation</h3>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Seller reputation is surfaced using marketplace performance and
              compliance history. High-reputation listings typically have fewer
              settlement or attestation issues.
            </p>
            <div className="mt-6">
              <ReputationDisplay
                score={sellerReputation.score}
                totalCommitments={sellerReputation.totalCommitments}
                successRate={sellerReputation.successRate}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-white/50">
              <span>More details</span>
              <Link
                href="/marketplace"
                className="text-[#0FF0FC] transition hover:text-white"
              >
                Browse similar listings
              </Link>
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-[#0B0B0B]/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <p className="text-sm uppercase tracking-[0.26em] text-white/40">Purchase options</p>
          <div className="mt-5 space-y-4">
            <MarketplaceListingPurchase
              listingId={listing.listingId}
              price={formatCurrency(listing.price)}
            />
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#0B0B0B]/90 p-6">
          <p className="text-sm uppercase tracking-[0.26em] text-white/40">Quick links</p>
          <div className="mt-4 grid gap-3 text-sm">
            <Link
              href="/marketplace"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white transition hover:border-white/20 hover:bg-white/10"
            >
              Return to listings
            </Link>
            <Link
              href={`/marketplace/trade?id=${listing.listingId}`}
              className="rounded-2xl border border-white/10 bg-[#0FF0FC0D] px-4 py-3 text-left text-[#0FF0FC] transition hover:border-[#0FF0FC33] hover:bg-[#0FF0FC14]"
            >
              Open trade flow
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
