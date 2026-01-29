"use client";

import React from "react";

export interface MarketplaceResultsLayoutProps {
  totalCount: number;
  viewMode: "grid" | "list";
  onViewModeChange: (view: "grid" | "list") => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  children: React.ReactNode;
}

export function MarketplaceResultsLayout({
  totalCount,
  viewMode,
  onViewModeChange,
  currentPage,
  totalPages,
  onPageChange,
  children,
}: MarketplaceResultsLayoutProps) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <section className="mt-6 flex flex-col gap-7" aria-label="Marketplace results">
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
            className={`w-[42px] h-9 rounded-xl border inline-flex items-center justify-center bg-[rgba(8,12,16,0.9)] transition-[border-color,box-shadow,background] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(0,212,255,0.6)] ${
              viewMode === "grid"
                ? "border-[rgba(0,212,255,0.6)] shadow-[0_0_12px_rgba(0,212,255,0.35)] bg-[rgba(7,14,18,0.95)]"
                : "border-[rgba(255,255,255,0.08)]"
            }`}
            aria-pressed={viewMode === "grid"}
            onClick={() => onViewModeChange("grid")}
          >
            <span aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className={`w-[18px] h-[18px] stroke-[rgba(0,212,255,0.9)] fill-[rgba(0,212,255,0.9)] ${
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
            className={`w-[42px] h-9 rounded-xl border inline-flex items-center justify-center bg-[rgba(8,12,16,0.9)] transition-[border-color,box-shadow,background] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(0,212,255,0.6)] ${
              viewMode === "list"
                ? "border-[rgba(0,212,255,0.6)] shadow-[0_0_12px_rgba(0,212,255,0.35)] bg-[rgba(7,14,18,0.95)]"
                : "border-[rgba(255,255,255,0.08)]"
            }`}
            aria-pressed={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
          >
            <span aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className={`w-[18px] h-[18px] stroke-[rgba(0,212,255,0.9)] fill-[rgba(0,212,255,0.9)] ${
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

      <div className="flex flex-col gap-5">
        {viewMode === "list" ? (
          <div className="rounded-[18px] border border-[rgba(255,255,255,0.12)] bg-[rgba(8,12,16,0.9)] px-6 py-10 text-center text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            List view is coming soon. Switch back to grid view to browse
            commitments.
          </div>
        ) : (
          children
        )}
      </div>

      <div className="flex items-center justify-center gap-3 flex-wrap max-[720px]:gap-2">
        <button
          type="button"
          className={`rounded-full border px-4 py-2 text-[0.9rem] bg-[rgba(8,12,16,0.95)] text-white/90 transition-[border-color,box-shadow,background] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.45)] hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(0,212,255,0.6)] max-[720px]:px-3 max-[720px]:py-[0.5rem] ${
            isFirstPage
              ? "opacity-40 cursor-not-allowed border-transparent"
              : "border-[rgba(255,255,255,0.15)]"
          }`}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isFirstPage}
        >
          Previous
        </button>

        <div className="inline-flex items-center gap-2" role="group" aria-label="Pages">
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              className={`rounded-full border px-4 py-2 text-[0.9rem] bg-[rgba(8,12,16,0.95)] transition-[border-color,box-shadow,background,color] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.45)] hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(0,212,255,0.6)] max-[720px]:px-3 max-[720px]:py-[0.5rem] ${
                page === currentPage
                  ? "border-[rgba(0,212,255,0.7)] bg-[rgba(0,212,255,0.18)] shadow-[0_0_12px_rgba(0,212,255,0.35)] text-[#00d4ff] font-semibold"
                  : "border-[rgba(255,255,255,0.15)] text-white/90"
              }`}
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`rounded-full border px-4 py-2 text-[0.9rem] bg-[rgba(8,12,16,0.95)] text-white/90 transition-[border-color,box-shadow,background] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.45)] hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(0,212,255,0.6)] max-[720px]:px-3 max-[720px]:py-[0.5rem] ${
            isLastPage
              ? "opacity-40 cursor-not-allowed border-transparent"
              : "border-[rgba(255,255,255,0.15)]"
          }`}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isLastPage}
        >
          Next
        </button>
      </div>
    </section>
  );
}
