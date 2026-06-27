"use client";

import React from "react";
import { MarketplaceEmptyState, MarketplaceEmptyStateType } from "./MarketplaceEmptyState";

export interface MarketplaceResultsLayoutProps {
  totalCount: number;
  viewMode: "grid" | "list";
  onViewModeChange: (view: "grid" | "list") => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  children: React.ReactNode;
  emptyStateType?: MarketplaceEmptyStateType;
  onRetry?: () => void;
  onClearFilters?: () => void;
}

export function MarketplaceResultsLayout({
  totalCount,
  viewMode,
  onViewModeChange,
  currentPage,
  totalPages,
  onPageChange,
  children,
  emptyStateType = "empty",
  onRetry,
  onClearFilters,
}: MarketplaceResultsLayoutProps) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;
  const showPagination = totalPages > 0;

  return (
    <section className="mt-0 pt-0 flex flex-col gap-8" aria-label="Marketplace results">
      <div className="flex items-center justify-between gap-6 flex-wrap max-[720px]:items-start">
        <p className="text-[0.95rem] text-white/65 tracking-[0.2px]">
          <span className="text-white/90 font-semibold">{totalCount}</span>{" "}
          commitments found
        </p>
        <div
          className="inline-flex items-center gap-2.5 max-[720px]:w-full max-[720px]:justify-start"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            className={`focus-ring w-[48px] h-10 rounded-xl border inline-flex items-center justify-center bg-[rgba(8,12,16,0.9)] transition-[border-color,box-shadow,background] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.4)] ${
              viewMode === "grid"
                ? "border-[rgba(0,212,255,0.6)] shadow-[0_0_12px_rgba(0,212,255,0.35)] bg-[rgba(7,14,18,0.95)]"
                : "border-[rgba(255,255,255,0.08)]"
            }`}
            aria-pressed={viewMode === "grid"}
            aria-label="Grid view"
            onClick={() => onViewModeChange("grid")}
          >
            <span aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className={`w-[20px] h-[20px] stroke-[rgba(0,212,255,0.9)] fill-[rgba(0,212,255,0.9)] ${
                  viewMode === "grid" ? "opacity-100" : "opacity-65"
                }`}
              >
                <rect x="3" y="3" width="5" height="5" rx="1.2" />
                <rect x="12" y="3" width="5" height="5" rx="1.2" />
                <rect x="3" y="12" width="5" height="5" rx="1.2" />
                <rect x="12" y="12" width="5" height="5" rx="1.2" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            className={`focus-ring w-[48px] h-10 rounded-xl border inline-flex items-center justify-center bg-[rgba(8,12,16,0.9)] transition-[border-color,box-shadow,background] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.4)] ${
              viewMode === "list"
                ? "border-[rgba(0,212,255,0.6)] shadow-[0_0_12px_rgba(0,212,255,0.35)] bg-[rgba(7,14,18,0.95)]"
                : "border-[rgba(255,255,255,0.08)]"
            }`}
            aria-pressed={viewMode === "list"}
            aria-label="List view"
            onClick={() => onViewModeChange("list")}
          >
            <span aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className={`w-[20px] h-[20px] stroke-[rgba(0,212,255,0.9)] fill-[rgba(0,212,255,0.9)] ${
                  viewMode === "list" ? "opacity-100" : "opacity-65"
                }`}
              >
                <rect x="3" y="4" width="14" height="2.5" rx="1.2" />
                <rect x="3" y="9" width="14" height="2.5" rx="1.2" />
                <rect x="3" y="14" width="14" height="2.5" rx="1.2" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {totalCount === 0 || emptyStateType === "error" ? (
          <MarketplaceEmptyState
            type={emptyStateType}
            onRetry={onRetry}
            onClearFilters={onClearFilters}
          />
        ) : (
          children
        )}
      </div>

      {showPagination && (
        <div className="flex items-center justify-center gap-3 flex-wrap mt-4">
          <button
            type="button"
            className={`focus-ring rounded-xl border px-5 py-3 text-[0.95rem] bg-[rgba(8,12,16,0.95)] text-white/90 transition-[border-color,box-shadow,background] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.45)] hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] active:scale-95 ${
              isFirstPage
                ? "opacity-40 cursor-not-allowed border-transparent"
                : "border-[rgba(255,255,255,0.15)]"
            }`}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={isFirstPage}
            aria-label="Previous page"
          >
            Previous
          </button>

          <div className="inline-flex items-center gap-2" role="group" aria-label="Pages">
            {pages.map((page) => (
              <button
                key={page}
                type="button"
                className={`focus-ring rounded-xl border min-w-[44px] h-11 px-3 py-2 text-[0.95rem] bg-[rgba(8,12,16,0.95)] transition-[border-color,box-shadow,background,color] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.45)] hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] active:scale-95 ${
                  page === currentPage
                    ? "border-[rgba(0,212,255,0.7)] bg-[rgba(0,212,255,0.18)] shadow-[0_0_12px_rgba(0,212,255,0.35)] text-[#00d4ff] font-semibold"
                    : "border-[rgba(255,255,255,0.15)] text-white/90"
                }`}
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? "page" : undefined}
                aria-label={`Page ${page}`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`focus-ring rounded-xl border px-5 py-3 text-[0.95rem] bg-[rgba(8,12,16,0.95)] text-white/90 transition-[border-color,box-shadow,background] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.45)] hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] active:scale-95 ${
              isLastPage
                ? "opacity-40 cursor-not-allowed border-transparent"
                : "border-[rgba(255,255,255,0.15)]"
            }`}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={isLastPage}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
