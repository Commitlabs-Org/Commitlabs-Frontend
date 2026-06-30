"use client";
import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

type CommitmentType = "balanced" | "aggressive" | "conservative";

const commitmentTypes: CommitmentType[] = [
  "balanced",
  "aggressive",
  "conservative",
];

interface Filters {
  sortBy: string;
  commitmentType: CommitmentType[];
  priceRange: [number, number];
  durationRange: [number, number];
  minCompliance: number;
  maxLoss: number;
}

interface MarketplaceFiltersProps {
  filters?: Filters;
  onFilterChange?: (filters: Filters) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const DEFAULTS: Filters = {
  sortBy: "price",
  commitmentType: ["balanced"],
  priceRange: [0, 1000000],
  durationRange: [0, 90],
  minCompliance: 0,
  maxLoss: 100,
};

const MarketplaceFilters = ({
  filters = DEFAULTS,
  onFilterChange,
}: MarketplaceFiltersProps) => {
  const [localFilters, setLocalFilters] = useState<Filters>(filters);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sort: true,
    type: true,
    price: true,
    duration: true,
    compliance: true,
    loss: true,
  });

  const [sidebarSearch, setSidebarSearch] = useState("");

  // Separate debounced state for continuous (range/text) inputs only.
  // Discrete toggles (commitmentType, sortBy) bypass debounce for instant feedback.
  const [continuousFilters, setContinuousFilters] = useState<
    Pick<Filters, "priceRange" | "durationRange" | "minCompliance" | "maxLoss">
  >({
    priceRange: filters.priceRange,
    durationRange: filters.durationRange,
    minCompliance: filters.minCompliance,
    maxLoss: filters.maxLoss,
  });

  const debouncedContinuous = useDebounce(continuousFilters, 300);

  // Track whether this is the initial mount to avoid double-firing on load.
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    const merged: Filters = { ...localFilters, ...debouncedContinuous };
    onFilterChange?.(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedContinuous]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  /** For discrete controls (toggles, sort): apply immediately. */
  const handleDiscreteUpdate = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    const updated = { ...localFilters, [key]: value };
    setLocalFilters(updated);
    onFilterChange?.(updated);
  };

  /** For continuous controls (range sliders): debounce the propagation. */
  const handleContinuousUpdate = <K extends keyof typeof continuousFilters>(
    key: K,
    value: (typeof continuousFilters)[K],
  ) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
    setContinuousFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setLocalFilters(DEFAULTS);
    setContinuousFilters({
      priceRange: DEFAULTS.priceRange,
      durationRange: DEFAULTS.durationRange,
      minCompliance: DEFAULTS.minCompliance,
      maxLoss: DEFAULTS.maxLoss,
    });
    // Cancel any pending debounced apply by immediately notifying with defaults.
    onFilterChange?.(DEFAULTS);
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const renderSectionToggle = (
    section: string,
    label: string,
    panelId: string,
    options?: { headingClassName?: string },
  ) => (
    <button
      type="button"
      className={`focus-ring flex w-full items-center justify-between cursor-pointer py-1.5 bg-transparent border-0 text-left text-white ${
        options?.headingClassName ?? "text-sm font-medium"
      }`}
      onClick={() => toggleSection(section)}
      aria-expanded={expandedSections[section]}
      aria-controls={panelId}
    >
      <span>{label}</span>
      {section !== "sort" &&
        (expandedSections[section] ? (
          <ChevronUp size={18} aria-hidden="true" />
        ) : (
          <ChevronDown size={18} aria-hidden="true" />
        ))}
    </button>
  );

  return (
    <aside
      className="focus-ring-container custom-scrollbar w-full md:fixed md:top-28 lg:left-10 xl:left-20 md:h-[600px] md:overflow-y-scroll md:w-80 bg-[#0A0A0A] border border-white/10 rounded-xl p-5 text-white custom-scrollbar"
      aria-label="Marketplace filters"
    >
      {/* Saved Searches */}
      <SavedSearches filters={filters} onApplyFilters={onFilterChange || (() => {})} />

      {/* Sort By */}
      <div className="mb-4 border-b border-white/5 pb-3">
        {renderSectionToggle("sort", "Sort By", "marketplace-filter-sort", {
          headingClassName: "text-lg font-semibold",
        })}
        <div
          id="marketplace-filter-sort"
          className="mt-2"
          hidden={!expandedSections.sort}
        >
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search filters..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="focus-ring w-full rounded-md border border-white/10 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-[#51A2FF]/50"
            />
          </div>
        </div>
      </div>

      {/* Commitment Type - discrete toggle, immediate */}
      <div className="mb-4 border-b border-white/5 pb-3">
        {renderSectionToggle("type", "Commitment Type", "marketplace-filter-type")}
        {expandedSections.type && (
          <div id="marketplace-filter-type" className="mt-2 flex flex-col gap-3">
            {commitmentTypes.map((type) => {
              const isActive = localFilters.commitmentType.includes(type);
              return (
                <button
                  type="button"
                  key={type}
                  className={`focus-ring flex items-center gap-2 cursor-pointer select-none bg-transparent border-0 text-left ${
                    isActive ? "text-white" : "text-white/70"
                  } rounded-md px-1 py-0.5`}
                  onClick={() => {
                    const current = localFilters.commitmentType;
                    const next = isActive
                      ? current.filter((t) => t !== type)
                      : [...current, type];
                    handleDiscreteUpdate("commitmentType", next);
                  }}
                  aria-pressed={isActive}
                >
                  <div
                    className={`w-5 h-5 rounded-sm border border-white/30 flex items-center justify-center transition-colors ${
                      isActive ? "bg-[#51A2FF] border-[#51A2FF]" : "bg-white/5"
                    }`}
                  >
                    {isActive && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-medium">
                    {type === "balanced" ? "Balanced" : type === "aggressive" ? "Aggressive" : "Safe"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Price Range - continuous, debounced */}
      <div className="mb-4 border-b border-white/5 pb-3">
        {renderSectionToggle("price", "Price Range", "marketplace-filter-price")}
        {expandedSections.price && (
          <div id="marketplace-filter-price" className="mt-3">
            <div className="relative h-1.5 bg-white/10 rounded-full">
              <div
                className="absolute h-1.5 bg-[#4A6B8A] rounded-full"
                style={{
                  left: "0%",
                  width: `${(localFilters.priceRange[1] / 1000000) * 100}%`,
                }}
              />
              <input
                aria-label="Maximum price"
                type="range"
                min="0"
                max="1000000"
                step="10000"
                value={localFilters.priceRange[1]}
                onChange={(e) =>
                  handleContinuousUpdate("priceRange", [0, Number(e.target.value)])
                }
                className="focus-ring absolute w-full top-[-6px] h-6 appearance-none bg-transparent pointer-events-auto cursor-pointer rounded-md"
              />
            </div>
            <div className="flex justify-between text-xs text-white/60 mt-2">
              <span>$0</span>
              <span>{formatCurrency(localFilters.priceRange[1])}</span>
            </div>
          </div>
        )}
      </div>

      {/* Duration - continuous, debounced */}
      <div className="mb-4 border-b border-white/5 pb-3">
        {renderSectionToggle(
          "duration",
          "Duration Remaining",
          "marketplace-filter-duration",
        )}
        {expandedSections.duration && (
          <div id="marketplace-filter-duration" className="mt-3">
            <div className="relative h-1.5 bg-white/10 rounded-full">
              <div
                className="absolute h-1.5 bg-[#4A6B8A] rounded-full"
                style={{
                  left: "0%",
                  width: `${(localFilters.durationRange[1] / 90) * 100}%`,
                }}
              />
              <input
                aria-label="Maximum duration remaining"
                type="range"
                min="0"
                max="90"
                step="1"
                value={localFilters.durationRange[1]}
                onChange={(e) =>
                  handleContinuousUpdate("durationRange", [0, Number(e.target.value)])
                }
                className="focus-ring absolute w-full top-[-6px] h-6 appearance-none bg-transparent pointer-events-auto cursor-pointer rounded-md"
              />
            </div>
            <div className="flex justify-between text-xs text-white/60 mt-2">
              <span>0 days</span>
              <span>{localFilters.durationRange[1]} days</span>
            </div>
          </div>
        )}
      </div>

      {/* Compliance - continuous, debounced */}
      <div className="mb-4 border-b border-white/5 pb-3">
        {renderSectionToggle(
          "compliance",
          "Min Compliance Score",
          "marketplace-filter-compliance",
        )}
        {expandedSections.compliance && (
          <div id="marketplace-filter-compliance" className="mt-3">
            <div className="relative h-1.5 bg-white/10 rounded-full">
              <div className="absolute h-1.5 bg-[#4A6B8A] rounded-full" style={{ width: `${localFilters.minCompliance}%` }} />
              <input
                aria-label="Minimum compliance score"
                type="range"
                min="0"
                max="100"
                value={localFilters.minCompliance}
                onChange={(e) => handleContinuousUpdate("minCompliance", Number(e.target.value))}
                className="focus-ring absolute w-full top-[-6px] h-6 appearance-none bg-transparent pointer-events-auto cursor-pointer rounded-md"
              />
            </div>
            <div className="flex justify-between text-xs text-white/60 mt-2">
              <span>0%</span>
              <span>{localFilters.minCompliance}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Max Loss - continuous, debounced */}
      <div className="mb-4 border-b border-white/5 pb-3">
        {renderSectionToggle(
          "loss",
          "Max Loss Threshold",
          "marketplace-filter-loss",
        )}
        {expandedSections.loss && (
          <div id="marketplace-filter-loss" className="mt-3">
            <div className="relative h-1.5 bg-white/10 rounded-full">
              <div className="absolute h-1.5 bg-[#4A6B8A] rounded-full" style={{ width: `${localFilters.maxLoss}%` }} />
              <input
                aria-label="Maximum loss threshold"
                type="range"
                min="0"
                max="100"
                value={localFilters.maxLoss}
                onChange={(e) => handleContinuousUpdate("maxLoss", Number(e.target.value))}
                className="focus-ring absolute w-full top-[-6px] h-6 appearance-none bg-transparent pointer-events-auto cursor-pointer rounded-md"
              />
            </div>
            <div className="flex justify-between text-xs text-white/60 mt-2">
              <span>0%</span>
              <span>{localFilters.maxLoss}%</span>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleReset}
        className="focus-ring w-full mt-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white/80 text-sm font-medium hover:bg-white/20 hover:text-white transition"
      >
        Reset Filters
      </button>
    </aside>
  );
};

export default MarketplaceFilters;
