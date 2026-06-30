// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketplaceCard, type MarketplaceCardProps } from "@/components/MarketplaceCard";

vi.mock("@/components/modals/CommitmentDetailsModal", () => ({
  CommitmentDetailsModal: ({
    isOpen,
    commitmentId,
    onClose,
  }: {
    isOpen: boolean;
    commitmentId: string;
    onClose?: () => void;
  }) => {
    if (!isOpen) return null;

    return (
      <div data-testid="commitment-details-modal">
        <span>{commitmentId}</span>
        <button data-testid="close-modal-btn" onClick={onClose}>Close</button>
      </div>
    );
  },
}));

function makeListing(overrides: Partial<MarketplaceCardProps> = {}): MarketplaceCardProps {
  return {
    id: "42",
    type: "Balanced",
    score: 84.6,
    amount: "$8,000",
    duration: "60 days",
    yield: "7.1%",
    maxLoss: "10%",
    owner: "0x1234567890abcdef",
    price: "$1,100",
    forSale: true,
    tradeHref: "/custom-trade",
    ...overrides,
  };
}

describe("MarketplaceCard", () => {
  describe("Score Clamping (clampScore)", () => {
    it.each([
      [Number.NaN, "0%"],
      [-10, "0%"],
      [-1, "0%"],
      [0, "0%"],
      [100, "100%"],
      [101, "100%"],
      [150, "100%"],
      [84.6, "85%"],
      [22.3, "22%"],
      [50.5, "51%"],
    ])("clamps score %s to %s", (score, expected) => {
      render(<MarketplaceCard {...makeListing({ score })} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  describe("Owner Address Truncation (truncateAddress)", () => {
    it("preserves short owner addresses unchanged (length <= 12)", () => {
      const shortAddress = "0123456789ab"; // length 12
      const { container } = render(<MarketplaceCard {...makeListing({ owner: shortAddress })} />);
      const ownerSpan = container.querySelector("span[class*='font-mono']");
      expect(ownerSpan).toHaveTextContent(shortAddress);
    });

    it("preserves even shorter owner addresses unchanged", () => {
      const shorterAddress = "short"; // length 5
      const { container } = render(<MarketplaceCard {...makeListing({ owner: shorterAddress })} />);
      const ownerSpan = container.querySelector("span[class*='font-mono']");
      expect(ownerSpan).toHaveTextContent(shorterAddress);
    });

    it("truncates owner addresses longer than 12 characters to the 6...4 form", () => {
      const boundaryLongAddress = "0123456789abc"; // length 13
      const { rerender, container } = render(
        <MarketplaceCard {...makeListing({ owner: boundaryLongAddress })} />
      );
      let ownerSpan = container.querySelector("span[class*='font-mono']");
      // 012345...9abc
      expect(ownerSpan).toHaveTextContent("012345...9abc");

      const standardLongAddress = "0123456789abcdef"; // length 16
      rerender(<MarketplaceCard {...makeListing({ owner: standardLongAddress })} />);
      ownerSpan = container.querySelector("span[class*='font-mono']");
      expect(ownerSpan).toHaveTextContent("012345...cdef");
    });

    it("handles empty, whitespace, and missing (null/undefined) owner addresses gracefully by displaying an empty label", () => {
      const { rerender, container } = render(<MarketplaceCard {...makeListing({ owner: "" })} />);
      let ownerSpan = container.querySelector("span[class*='font-mono']");
      expect(ownerSpan).toHaveTextContent("");

      rerender(<MarketplaceCard {...makeListing({ owner: "   " })} />);
      ownerSpan = container.querySelector("span[class*='font-mono']");
      expect(ownerSpan).toHaveTextContent("");

      // @ts-expect-error - testing invalid owner prop at runtime
      rerender(<MarketplaceCard {...makeListing({ owner: null })} />);
      ownerSpan = container.querySelector("span[class*='font-mono']");
      expect(ownerSpan).toHaveTextContent("");

      // @ts-expect-error - testing invalid owner prop at runtime
      rerender(<MarketplaceCard {...makeListing({ owner: undefined })} />);
      ownerSpan = container.querySelector("span[class*='font-mono']");
      expect(ownerSpan).toHaveTextContent("");
    });
  });

  describe("Trade Link and Sale State Rendering", () => {
    it("renders the price and trade link when the listing is for sale", () => {
      render(<MarketplaceCard {...makeListing({ forSale: true })} />);

      expect(screen.getByText("Price")).toBeInTheDocument();
      expect(screen.getByText("$1,100")).toBeInTheDocument();
      
      const tradeLink = screen.getByRole("link", { name: /trade 42/i });
      expect(tradeLink).toBeInTheDocument();
      expect(tradeLink).toHaveAttribute("href", "/custom-trade");
      expect(screen.queryByText("Not for sale")).not.toBeInTheDocument();
    });

    it("renders the custom tradeHref when provided", () => {
      render(<MarketplaceCard {...makeListing({ forSale: true, tradeHref: "/custom-link-path" })} />);
      const tradeLink = screen.getByRole("link", { name: /trade 42/i });
      expect(tradeLink).toHaveAttribute("href", "/custom-link-path");
    });

    it("falls back to the default trade url pattern when tradeHref is undefined or missing", () => {
      render(<MarketplaceCard {...makeListing({ forSale: true, tradeHref: undefined })} />);
      const tradeLink = screen.getByRole("link", { name: /trade 42/i });
      expect(tradeLink).toHaveAttribute("href", "/marketplace/trade?id=42");
    });

    it("renders as Not for sale and hides the trade CTA link when forSale is false", () => {
      render(<MarketplaceCard {...makeListing({ forSale: false })} />);

      expect(screen.getByText("Not for sale")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /trade 42/i })).not.toBeInTheDocument();
      expect(screen.queryByText("Price")).not.toBeInTheDocument();
    });
  });

  describe("Commitment Types Style and SVGs", () => {
    it("renders specific classes and the Safe icon for Safe type", () => {
      const { container } = render(<MarketplaceCard {...makeListing({ type: "Safe" })} />);
      
      const article = container.querySelector("article");
      expect(article?.className).toContain("border-[#00C95066]");

      const typeBadge = screen.getByText("Safe");
      expect(typeBadge.className).toContain("bg-[#0f2a1d]");
      expect(typeBadge.className).toContain("text-[#00C950]");

      const scoreBadge = screen.getByText("85%");
      expect(scoreBadge.className).toContain("text-[#00C950]/95");

      // Verify the Safe icon SVG stroke matches
      const svg = container.querySelector("svg");
      const path = svg?.querySelector("path");
      expect(path).toHaveAttribute("stroke", "#05DF72");
    });

    it("renders specific classes and the Balanced icon for Balanced type", () => {
      const { container } = render(<MarketplaceCard {...makeListing({ type: "Balanced" })} />);
      
      const article = container.querySelector("article");
      expect(article?.className).toContain("border-[#2B7FFF66]");

      const typeBadge = screen.getByText("Balanced");
      expect(typeBadge.className).toContain("bg-[#122238]");
      expect(typeBadge.className).toContain("text-[#51A2FF]");

      const scoreBadge = screen.getByText("85%");
      expect(scoreBadge.className).toContain("text-[#51A2FF]/95");

      // Verify the Balanced icon SVG stroke matches
      const svg = container.querySelector("svg");
      const path = svg?.querySelector("path");
      expect(path).toHaveAttribute("stroke", "#51A2FF");
    });

    it("renders specific classes and the Aggressive icon for Aggressive type", () => {
      const { container } = render(<MarketplaceCard {...makeListing({ type: "Aggressive" })} />);
      
      const article = container.querySelector("article");
      expect(article?.className).toContain("border-[#FF690066]");

      const typeBadge = screen.getByText("Aggressive");
      expect(typeBadge.className).toContain("bg-[#2b1c10]");
      expect(typeBadge.className).toContain("text-[#FF8904]");

      const scoreBadge = screen.getByText("85%");
      expect(scoreBadge.className).toContain("text-[#FF8904]/95");

      // Verify the Aggressive icon SVG stroke matches
      const svg = container.querySelector("svg");
      const path = svg?.querySelector("path");
      expect(path).toHaveAttribute("stroke", "#FF8904");
    });
  });

  describe("Modal Opening and Closing Path", () => {
    it("opens and mounts CommitmentDetailsModal when clicking the View button on forSale listings", () => {
      render(<MarketplaceCard {...makeListing({ forSale: true })} />);

      expect(screen.queryByTestId("commitment-details-modal")).not.toBeInTheDocument();

      const viewButton = screen.getByRole("button", { name: /view 42/i });
      fireEvent.click(viewButton);

      const modal = screen.getByTestId("commitment-details-modal");
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveTextContent("42");
    });

    it("opens and mounts CommitmentDetailsModal when clicking the View button on not-for-sale listings", () => {
      render(<MarketplaceCard {...makeListing({ forSale: false })} />);

      expect(screen.queryByTestId("commitment-details-modal")).not.toBeInTheDocument();

      const viewButton = screen.getByRole("button", { name: /view 42/i });
      fireEvent.click(viewButton);

      const modal = screen.getByTestId("commitment-details-modal");
      expect(modal).toBeInTheDocument();
    });

    it("closes the details modal when the onClose event is triggered in the modal", () => {
      render(<MarketplaceCard {...makeListing({ forSale: true })} />);

      const viewButton = screen.getByRole("button", { name: /view 42/i });
      fireEvent.click(viewButton);

      const modal = screen.getByTestId("commitment-details-modal");
      expect(modal).toBeInTheDocument();

      const closeButton = screen.getByTestId("close-modal-btn");
      fireEvent.click(closeButton);

      expect(screen.queryByTestId("commitment-details-modal")).not.toBeInTheDocument();
    });
  });
});


