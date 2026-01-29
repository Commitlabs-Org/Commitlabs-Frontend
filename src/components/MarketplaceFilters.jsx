import React, { useState } from "react";

const DEFAULT_FILTERS = {
  sortBy: "price",
  commitmentType: "balanced",
  priceRange: [0, 1_000_000],
  durationRange: [0, 90],
  minCompliance: 0,
  maxLoss: 100,
};

const MarketplaceFilters = ({
  filters = DEFAULT_FILTERS,
  onFilterChange,
  isOpen = true,
  onClose,
}) => {
  const [localFilters, setLocalFilters] = useState(filters);

  const update = (key, value) => {
    const next = { ...localFilters, [key]: value };
    setLocalFilters(next);
    onFilterChange?.(next);
  };

  const reset = () => {
    setLocalFilters(DEFAULT_FILTERS);
    onFilterChange?.(DEFAULT_FILTERS);
  };

  const formatCurrency = (v) =>
    v >= 1_000_000
      ? `$${v / 1_000_000}M`
      : v >= 1_000
        ? `$${v / 1_000}K`
        : `$${v}`;

  return (
    <>
      {/* Mobile overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity md:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`
            fixed z-50 md:static
            bottom-0 left-0
            w-full md:w-80
            max-h-[85vh] md:max-h-[calc(100vh-120px)]
            overflow-y-auto
            rounded-t-2xl md:rounded-2xl
            bg-[radial-gradient(120%_120%_at_50%_0%,#141414_0%,#0a0a0a_55%,#050505_100%)]
            border border-white/5
            shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.04)]
            p-6
            transition-transform
            ${isOpen ? "translate-y-0" : "translate-y-full md:translate-y-0"}
  `}
        role="complementary"
        aria-label="Marketplace filters"
      >
        {/* Close button (mobile) */}
        <button
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 h-8 w-8 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20"
          aria-label="Close filters"
        >
          ✕
        </button>

        {/* SECTION */}
        <Section title="Sort By">
          <select
            value={localFilters.sortBy}
            onChange={(e) => update("sortBy", e.target.value)}
            className="w-full rounded-lg bg-white/40 border border-cyan-400/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="price">Price</option>
            <option value="compliance">Compliance Score</option>
            <option value="duration">Duration</option>
            <option value="newest">Newest</option>
          </select>
        </Section>

        {/* Commitment Type */}
        <Section title="Commitment Type">
          <div className="space-y-2">
            {["safe", "balanced", "aggressive"].map((type) => {
              const active = localFilters.commitmentType === type;
              return (
                <button
                  key={type}
                  onClick={() => update("commitmentType", type)}
                  className={`w-full rounded-lg px-4 py-2 text-left text-sm transition
                    ${
                      active
                        ? "bg-cyan-400/10 text-cyan-300 border border-cyan-400/40"
                        : "bg-white/5 text-gray-300 hover:bg-white/10"
                    }`}
                >
                  {type[0].toUpperCase() + type.slice(1)}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Price */}
        <RangeSection
          title="Price Range"
          min={0}
          max={1_000_000}
          value={localFilters.priceRange}
          onChange={(v) => update("priceRange", v)}
          format={formatCurrency}
        />

        {/* Duration */}
        <RangeSection
          title="Duration Remaining"
          min={0}
          max={90}
          value={localFilters.durationRange}
          onChange={(v) => update("durationRange", v)}
          format={(v) => `${v} days`}
        />

        {/* Compliance */}
        <SingleSlider
          title="Min Compliance Score"
          value={localFilters.minCompliance}
          onChange={(v) => update("minCompliance", v)}
          suffix="%"
        />

        {/* Max Loss */}
        <SingleSlider
          title="Max Loss Threshold"
          value={localFilters.maxLoss}
          onChange={(v) => update("maxLoss", v)}
          suffix="%"
        />

        <button
          onClick={reset}
          className="mt-6 w-full rounded-xl bg-white/5 border border-cyan-400/20 py-3 text-sm uppercase tracking-wide text-gray-200 hover:bg-white/10 hover:text-cyan-300 transition"
        >
          Reset Filters
        </button>
      </aside>
    </>
  );
};

/* ---------- Helpers ---------- */

const Section = ({ title, children }) => (
  <div className="mb-6 border-b border-cyan-400/10 pb-6 last:border-0">
    <p className="mb-3 text-xs uppercase tracking-widest text-cyan-300">
      {title}
    </p>
    {children}
  </div>
);

const RangeSection = ({ title, min, max, value, onChange, format }) => (
  <Section title={title}>
    <input
      type="range"
      min={min}
      max={max}
      value={value[0]}
      onChange={(e) => onChange([+e.target.value, value[1]])}
      className="w-full accent-cyan-400"
    />
    <input
      type="range"
      min={min}
      max={max}
      value={value[1]}
      onChange={(e) => onChange([value[0], +e.target.value])}
      className="w-full accent-cyan-400 mt-1"
    />
    <div className="mt-2 flex justify-between text-xs text-cyan-300">
      <span>{format(value[0])}</span>
      <span>{format(value[1])}</span>
    </div>
  </Section>
);

const SingleSlider = ({ title, value, onChange, suffix }) => (
  <Section title={title}>
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      onChange={(e) => onChange(+e.target.value)}
      className="w-full accent-cyan-400"
    />
    <div className="mt-2 text-right text-xs text-cyan-300">
      {value}
      {suffix}
    </div>
  </Section>
);

export default MarketplaceFilters;
