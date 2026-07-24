// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MarketplaceRow, type Listing } from "@/app/marketplace/page";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    "aria-label": ariaLabel,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement("a", { href, className, "aria-label": ariaLabel, ...rest }, children),
}));

vi.mock("@/components/TrustBadge", () => ({
  TrustBadge: () => <div data-testid="trust-badge" />,
}));

const mockItem: Listing = {
  id: "123",
  type: "Safe",
  score: 95,
  amount: "$50,000",
  duration: "25 days",
  yield: "5.2%",
  maxLoss: "2%",
  owner: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  price: "$52,000",
  forSale: true,
  trustLevel: "verified",
};

describe("MarketplaceRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a Trade link that resolves to the commitment details page", () => {
    render(<MarketplaceRow item={mockItem} />);
    const tradeLink = screen.getByRole("link", { name: "Trade" });
    expect(tradeLink).toBeInTheDocument();
    
    // Test asserting the Trade action navigates somewhere that actually resolves
    expect(tradeLink).toHaveAttribute("href", "/commitments/123");
  });

  it("renders a Details link that resolves to the commitment details page", () => {
    render(<MarketplaceRow item={mockItem} />);
    const detailsLink = screen.getByRole("link", { name: "Details" });
    expect(detailsLink).toBeInTheDocument();
    
    expect(detailsLink).toHaveAttribute("href", "/commitments/123");
  });

  it("does not render Trade link when not for sale", () => {
    const notForSaleItem = { ...mockItem, forSale: false };
    render(<MarketplaceRow item={notForSaleItem} />);
    
    const tradeLink = screen.queryByRole("link", { name: "Trade" });
    expect(tradeLink).not.toBeInTheDocument();
  });
});
