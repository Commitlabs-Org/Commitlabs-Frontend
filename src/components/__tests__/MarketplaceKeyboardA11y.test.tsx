// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MarketplaceFilters from "@/components/MarketplaceFilter/MarketplaceFilters";
import { MarketplaceGrid } from "@/components/MarketplaceGrid";
import { MarketplaceResultsLayout } from "@/components/MarketplaceResultsLayout";
import type { MarketplaceCardProps } from "@/components/MarketplaceCard";

vi.mock("@/components/modals/CommitmentDetailsModal", () => ({
  CommitmentDetailsModal: () => null,
}));

const defaultFilters = {
  sortBy: "price",
  commitmentType: ["balanced" as const],
  priceRange: [0, 1000000] as [number, number],
  durationRange: [0, 90] as [number, number],
  minCompliance: 0,
  maxLoss: 100,
};

const listing: MarketplaceCardProps = {
  id: "12",
  type: "Balanced",
  score: 88,
  amount: "$8,000",
  duration: "60 days",
  yield: "7.1%",
  maxLoss: "10%",
  owner: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
  price: "$1,100",
  forSale: true,
};

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

describe("Marketplace keyboard accessibility", () => {
  it("exposes keyboard-operable filter section toggles with expanded state", () => {
    render(<MarketplaceFilters filters={defaultFilters} />);

    const typeToggle = screen.getByRole("button", { name: /commitment type/i });
    expect(typeToggle).toHaveAttribute("aria-expanded", "true");
    expect(typeToggle).toHaveAttribute(
      "aria-controls",
      "marketplace-filter-type",
    );
    expect(typeToggle.className).toContain("focus-ring");

    fireEvent.click(typeToggle);
    expect(typeToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Maximum price")).toBeInTheDocument();
  });

  it("supports keyboard activation for filter chips and reset", () => {
    const onFilterChange = vi.fn();
    render(
      <MarketplaceFilters
        filters={defaultFilters}
        onFilterChange={onFilterChange}
      />,
    );

    const aggressiveToggle = screen.getByRole("button", { name: /aggressive/i });
    aggressiveToggle.focus();
    fireEvent.keyDown(aggressiveToggle, { key: "Enter" });
    fireEvent.click(aggressiveToggle);

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        commitmentType: ["balanced", "aggressive"],
      }),
    );

    const resetButton = screen.getByRole("button", { name: /reset filters/i });
    resetButton.focus();
    fireEvent.keyDown(resetButton, { key: " " });
    fireEvent.click(resetButton);

    expect(onFilterChange).toHaveBeenLastCalledWith(defaultFilters);
  });

  it("keeps a logical tab order across filters, cards, and view toggles", () => {
    const onViewModeChange = vi.fn();
    const { container } = render(
      <>
        <MarketplaceFilters filters={defaultFilters} />
        <MarketplaceResultsLayout
          totalCount={1}
          viewMode="grid"
          onViewModeChange={onViewModeChange}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        >
          <MarketplaceGrid items={[listing]} />
        </MarketplaceResultsLayout>
      </>,
    );

    const focusables = getFocusableElements(container);
    const labels = focusables.map(
      (element) =>
        element.getAttribute("aria-label") ??
        element.textContent?.trim() ??
        element.getAttribute("placeholder") ??
        "",
    );

    expect(labels.some((label) => /commitment type/i.test(label))).toBe(true);
    expect(labels.some((label) => /balanced/i.test(label))).toBe(true);
    expect(labels.some((label) => /grid view/i.test(label))).toBe(true);
    expect(labels.some((label) => /view 12/i.test(label))).toBe(true);
    expect(labels.some((label) => /trade 12/i.test(label))).toBe(true);
  });

  it("activates view mode toggles from the keyboard", () => {
    const onViewModeChange = vi.fn();
    const { rerender } = render(
      <MarketplaceResultsLayout
        totalCount={1}
        viewMode="grid"
        onViewModeChange={onViewModeChange}
        currentPage={1}
        totalPages={2}
        onPageChange={vi.fn()}
      >
        <div>results</div>
      </MarketplaceResultsLayout>,
    );

    const listView = screen.getByRole("button", { name: /list view/i });
    expect(listView.className).toContain("focus-ring");
    listView.focus();
    fireEvent.keyDown(listView, { key: "Enter" });
    fireEvent.click(listView);

    expect(onViewModeChange).toHaveBeenCalledWith("list");

    rerender(
      <MarketplaceResultsLayout
        totalCount={1}
        viewMode="list"
        onViewModeChange={onViewModeChange}
        currentPage={1}
        totalPages={2}
        onPageChange={vi.fn()}
      >
        <div>results</div>
      </MarketplaceResultsLayout>,
    );

    expect(screen.getByRole("button", { name: /grid view/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /list view/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("focuses the empty results panel after filters clear all listings", () => {
    render(<MarketplaceGrid items={[]} />);

    const emptyState = screen.getByText("No commitments available").closest(
      "#marketplace-empty-state",
    );
    expect(emptyState).not.toBeNull();
    expect(emptyState).toHaveAttribute("tabindex", "-1");
    expect(emptyState?.className).toContain("focus-ring");

    const grid = screen.getByRole("region", { name: /marketplace listings/i });
    expect(within(grid).queryAllByRole("article")).toHaveLength(0);
  });

  it("applies focus-ring styles to marketplace card actions", () => {
    render(<MarketplaceGrid items={[listing]} />);

    const viewButton = screen.getByRole("button", { name: /view 12/i });
    const tradeButton = screen.getByRole("button", { name: /trade 12/i });

    expect(viewButton.className).toContain("focus-ring");
    expect(tradeButton.className).toContain("focus-ring");
  });
});
