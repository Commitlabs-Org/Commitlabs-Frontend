"use client";
import React, { useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

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

const MarketplaceFilters = ({
  filters = {
    sortBy: "price",
    commitmentType: ["balanced"],
    priceRange: [0, 1000000],
    durationRange: [0, 90],
    minCompliance: 0,
    maxLoss: 100,
  },
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

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleFilterUpdate = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    const updated = { ...localFilters, [key]: value };
    setLocalFilters(updated);
    onFilterChange?.(updated);
  };

  const handleReset = () => {
    const defaults: Filters = {
      sortBy: "price",
      commitmentType: ["balanced"],
      priceRange: [0, 1000000],
      durationRange: [0, 90],
      minCompliance: 0,
      maxLoss: 100,
    };
    setLocalFilters(defaults);
    onFilterChange?.(defaults);
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <aside
      className="focus-ring-container custom-scrollbar w-full md:fixed md:top-28 lg:left-10 xl:left-20 md:h-[600px] md:overflow-y-scroll md:w-80 bg-[#0A0A0A] border border-white/10 rounded-xl p-5 text-white custom-scrollbar"
    >
      {/* Sort By */}
      <div className="mb-4 border-b border-white/5 pb-3">
        <div
          className="flex items-center justify-between cursor-pointer py-1.5"
          onClick={() => toggleSection("sort")}
        >
          <span className="text-lg font-semibold">Sort By</span>
        </div>
        <div className="mt-2">
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
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

      {/* Commitment Type */}
      <div className="mb-4 border-b border-white/5 pb-3">
        <div
          className="flex items-center justify-between cursor-pointer py-1.5"
          onClick={() => toggleSection("type")}
        >
          <span className="text-sm font-medium">Commitment Type</span>
          {expandedSections.type ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
        {expandedSections.type && (
          <div className="mt-2 flex flex-col gap-3">
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
                    handleFilterUpdate("commitmentType", next);
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

      {/* Price Range */}
      <div className="mb-4 border-b border-white/5 pb-3">
        <div
          className="flex items-center justify-between cursor-pointer py-1.5"
          onClick={() => toggleSection("price")}
        >
          <span className="text-sm font-medium">Price Range</span>
          {expandedSections.price ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
        {expandedSections.price && (
          <div className="mt-3">
            <div className="relative h-1.5 bg-white/10 rounded-full">
              {/* Active range */}
              <div
                className="absolute h-1.5 bg-[#4A6B8A] rounded-full"
                style={{
                  left: "0%",
                  width: `${(localFilters.priceRange[1] / 1000000) * 100}%`,
                }}
              />
              {/* Draggable handle */}
              <input
                type="range"
                min="0"
                max="1000000"
                step="10000"
                value={localFilters.priceRange[1]}
                onChange={(e) =>
                  handleFilterUpdate("priceRange", [0, Number(e.target.value)])
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

      {/* Duration */}
      <div className="mb-4 border-b border-white/5 pb-3">
        <div
          className="flex items-center justify-between cursor-pointer py-1.5"
          onClick={() => toggleSection("duration")}
        >
          <span className="text-sm font-medium">Duration Remaining</span>
          {expandedSections.duration ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
        {expandedSections.duration && (
          <div className="mt-3">
            <div className="relative h-1.5 bg-white/10 rounded-full">
              <div
                className="absolute h-1.5 bg-[#4A6B8A] rounded-full"
                style={{
                  left: "0%",
                  width: `${(localFilters.durationRange[1] / 90) * 100}%`,
                }}
              />
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={localFilters.durationRange[1]}
                onChange={(e) =>
                  handleFilterUpdate("durationRange", [0, Number(e.target.value)])
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

      {/* Compliance */}
      <div className="mb-4 border-b border-white/5 pb-3">
        <div
          className="flex items-center justify-between cursor-pointer py-1.5"
          onClick={() => toggleSection("compliance")}
        >
          <span className="text-sm font-medium">Min Compliance Score</span>
          {expandedSections.compliance ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
        {expandedSections.compliance && (
          <div className="mt-3">
            <div className="relative h-1.5 bg-white/10 rounded-full">
              <div className="absolute h-1.5 bg-[#4A6B8A] rounded-full" style={{ width: `${localFilters.minCompliance}%` }} />
              <input
                type="range"
                min="0"
                max="100"
                value={localFilters.minCompliance}
                onChange={(e) => handleFilterUpdate("minCompliance", Number(e.target.value))}
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

      {/* Max Loss */}
      <div className="mb-4 border-b border-white/5 pb-3">
        <div
          className="flex items-center justify-between cursor-pointer py-1.5"
          onClick={() => toggleSection("loss")}
        >
          <span className="text-sm font-medium">Max Loss Threshold</span>
          {expandedSections.loss ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
        {expandedSections.loss && (
          <div className="mt-3">
            <div className="relative h-1.5 bg-white/10 rounded-full">
              <div className="absolute h-1.5 bg-[#4A6B8A] rounded-full" style={{ width: `${localFilters.maxLoss}%` }} />
              <input
                type="range"
                min="0"
                max="100"
                value={localFilters.maxLoss}
                onChange={(e) => handleFilterUpdate("maxLoss", Number(e.target.value))}
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
        onClick={handleReset}
        className="focus-ring w-full mt-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white/80 text-sm font-medium hover:bg-white/20 hover:text-white transition"
      >
        Reset Filters
      </button>
    </aside>
  );
};

export default MarketplaceFilters;
