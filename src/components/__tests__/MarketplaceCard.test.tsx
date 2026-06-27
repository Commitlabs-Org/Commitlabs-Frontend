// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketplaceCard, type MarketplaceCardProps } from "@/components/MarketplaceCard";

vi.mock("@/components/modals/CommitmentDetailsModal", () => ({
  CommitmentDetailsModal: ({
    isOpen,
    commitmentId,
  }: {
    isOpen: boolean;
    commitmentId: string;
  }) => {
    if (!isOpen) return null;

    return <div data-testid="commitment-details-modal">{commitmentId}</div>;
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
  it.each([
    [Number.NaN, "0%"],
    [-12, "0%"],
    [120, "100%"],
    [84.6, "85%"],
  ])("clamps score %p to %s", (score, expected) => {
    render(<MarketplaceCard {...makeListing({ score })} />);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renders short owners unchanged and truncates long owners", () => {
    const { rerender, container } = render(
      <MarketplaceCard {...makeListing({ owner: "short" })} />,
    );

    const ownerValue = container.querySelector("span[class*='font-mono']");
    expect(ownerValue).toHaveTextContent("short");

    rerender(
      <MarketplaceCard
        {...makeListing({ owner: "0123456789abcdef" })}
      />,
    );

    expect(screen.getByText("012345...cdef")).toBeInTheDocument();
  });

  it("renders an empty owner label when the owner is blank", () => {
    const { container } = render(<MarketplaceCard {...makeListing({ owner: "   " })} />);

    const ownerValue = container.querySelector("span[class*='font-mono']");
    expect(ownerValue).toHaveTextContent("");
  });

  it("shows the trade CTA only when the listing is for sale and uses the custom trade href", () => {
    const { rerender } = render(<MarketplaceCard {...makeListing()} />);

    const tradeLink = screen.getByRole("link", { name: /trade 42/i });
    expect(tradeLink).toHaveAttribute("href", "/custom-trade");

    rerender(<MarketplaceCard {...makeListing({ forSale: false, tradeHref: undefined })} />);

    expect(screen.queryByRole("link", { name: /trade 42/i })).not.toBeInTheDocument();
    expect(screen.getByText("Not for sale")).toBeInTheDocument();
  });

  it("opens the commitment details modal when the view button is clicked", () => {
    render(<MarketplaceCard {...makeListing()} />);

    fireEvent.click(screen.getByRole("button", { name: /view 42/i }));

    expect(screen.getByTestId("commitment-details-modal")).toHaveTextContent("42");
  });
});
