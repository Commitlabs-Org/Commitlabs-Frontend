// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/backend/services/marketplace", () => ({
  marketplaceService: {
    getPublicListing: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

import ErrorPage from "./error";

const mockListing = {
  listingId: "LST-001",
  commitmentId: "CMT-001",
  type: "Safe",
  amount: 50000,
  remainingDays: 30,
  maxLoss: 2,
  currentYield: 5.2,
  complianceScore: 95,
  price: 52000,
};

const { marketplaceService } = await import("@/lib/backend/services/marketplace");
const { notFound } = await import("next/navigation");
const { default: MarketplaceListingPage, generateMetadata } = await import("./page");

describe("Marketplace listing detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders listing details and purchase CTA", async () => {
    vi.mocked(marketplaceService.getPublicListing).mockResolvedValue(mockListing as any);

    const element = await MarketplaceListingPage({ params: { id: "LST-001" } });
    render(element);

    expect(screen.getByRole("heading", { name: /Listing LST-001/i })).toBeInTheDocument();
    expect(screen.getByText(/Commitment ID/i)).toBeInTheDocument();
    expect(screen.getByText(/CMT-001/i)).toBeInTheDocument();
    expect(screen.getByText(/Price/i)).toBeInTheDocument();
    expect(screen.getAllByText("$52,000")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect wallet|check eligibility/i })).toBeInTheDocument();
  });

  it("calls notFound when the requested listing does not exist", async () => {
    vi.mocked(marketplaceService.getPublicListing).mockResolvedValue(null);

    await expect(MarketplaceListingPage({ params: { id: "LST-999" } })).rejects.toThrow(
      "notFound",
    );

    expect(notFound).toHaveBeenCalled();
  });

  it("generates metadata from the listing", async () => {
    vi.mocked(marketplaceService.getPublicListing).mockResolvedValue(mockListing as any);

    const metadata = await generateMetadata({ params: { id: "LST-001" } });

    expect(metadata?.title).toContain("LST-001");
    expect(metadata?.description).toContain("trust");
  });

  it("renders the error fallback when an error boundary is used", () => {
    render(<ErrorPage error={new Error("Unexpected failure")} reset={() => {}} />);

    expect(screen.getByText(/Unable to load listing/i)).toBeInTheDocument();
    expect(screen.getByText(/Unexpected failure/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });
});
