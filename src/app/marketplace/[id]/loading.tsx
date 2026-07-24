export default function MarketplaceListingLoading() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-1/3 rounded-full bg-white/10" />
          <div className="h-8 w-2/3 rounded-full bg-white/10" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-44 rounded-[28px] bg-white/5" />
            <div className="h-44 rounded-[28px] bg-white/5" />
          </div>
          <div className="h-[420px] rounded-[28px] bg-white/5" />
        </div>
      </div>
    </div>
  );
}
