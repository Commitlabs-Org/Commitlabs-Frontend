'use client';

import Link from 'next/link';

export default function MarketplaceListingError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-white/10 bg-[#0B0B0B]/95 p-10 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#0FF0FC]">
            Something went wrong
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Unable to load listing</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60">
            {error?.message || 'An unexpected error occurred while loading this page.'}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-[14px] bg-[#0FF0FC] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110"
              onClick={() => reset()}
            >
              Try again
            </button>
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center rounded-[14px] border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              Back to marketplace
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
