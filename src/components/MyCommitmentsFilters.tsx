'use client';

import React from 'react';
import { SearchIcon, ChevronDownIcon } from './icons/FilterIcons';

interface MyCommitmentsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  typeFilter: string;
  onTypeChange: (type: string) => void;
}

const MyCommitmentsFilters: React.FC<MyCommitmentsFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
}) => {
  return (
    <div className="relative z-10 flex flex-col gap-4 mb-6 max-[640px]:mt-6 max-[640px]:mb-8">
      <div className="relative w-full">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={20} />
        <input
          type="text"
          placeholder="Search by commitment ID…"
          className="focus-ring w-full rounded-[14px] border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.08)] py-3.5 pl-12 pr-4 text-[16px] text-white transition-all duration-200 ease-[ease] focus:border-[#0FF0FC] focus:outline-none focus:shadow-[0_0_15px_rgba(15,240,252,0.2)]"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-3 max-[640px]:flex-col max-[640px]:gap-3">
        <div className="relative min-w-[160px] max-[640px]:w-full max-[640px]:min-w-0">
          <select
            className="focus-ring w-full appearance-none rounded-[14px] border border-[rgba(255,255,255,0.2)] bg-[#0a0a0a] py-2.5 pl-4 pr-10 text-[14px] text-white transition-all duration-200 ease-[ease] hover:border-[rgba(255,255,255,0.2)] focus:border-[#0FF0FC] focus:outline-none"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Settled">Settled</option>
            <option value="Violated">Violated</option>
            <option value="Early Exit">Early Exit</option>
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={16} />
        </div>

        <div className="relative min-w-[160px] max-[640px]:w-full max-[640px]:min-w-0">
          <select
            className="focus-ring w-full appearance-none rounded-[14px] border border-[rgba(255,255,255,0.2)] bg-[#0a0a0a] py-2.5 pl-4 pr-10 text-[14px] text-white transition-all duration-200 ease-[ease] hover:border-[rgba(255,255,255,0.2)] focus:border-[#0FF0FC] focus:outline-none"
            value={typeFilter}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            <option value="All">All</option>
            <option value="Safe">Safe</option>
            <option value="Balanced">Balanced</option>
            <option value="Aggressive">Aggressive</option>
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={16} />
        </div>

        <div className="relative min-w-[200px] flex-[0_0_200px] max-[640px]:w-full max-[640px]:min-w-0 max-[640px]:flex-none">
          <select className="focus-ring w-full appearance-none rounded-[14px] border border-[rgba(255,255,255,0.2)] bg-[#0a0a0a] py-2.5 pl-4 pr-10 text-[14px] text-white transition-all duration-200 ease-[ease] hover:border-[rgba(255,255,255,0.2)] focus:border-[#0FF0FC] focus:outline-none">
            <option value="Any">Any</option>
            <option value="Short">Short Term (&lt; 30 days)</option>
            <option value="Medium">Medium Term (30-90 days)</option>
            <option value="Long">Long Term (&gt; 90 days)</option>
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={16} />
        </div>
      </div>
    </div>
  );
};

export default MyCommitmentsFilters;
