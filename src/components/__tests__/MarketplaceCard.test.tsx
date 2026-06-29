// @vitest-environment happy-dom

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";

import {
  MarketplaceCard,
  type CommitmentType,
  type MarketplaceCardProps,
} from "@/components/MarketplaceCard";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

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

// Light mock: just renders a labelled dialog sentinel when open so we can
// assert modal open/close without depending on Dialog/portal internals.
vi.mock("@/components/modals/CommitmentDetailsModal", () => ({
  CommitmentDetailsModal: ({
    isOpen,
    commitmentId,
    onClose,
  }: {
    isOpen: boolean;
    commitmentId: string;
    onClose: () => void;
  }) =>
    isOpen
      ? React.createElement(
          "div",
          {
            role: "dialog",
            "aria-modal": "true",
            "data-testid": "commitment-modal",
            "data-commitment-id": commitmentId,
          },
          React.createElement("button", { onClick: onClose }, "Close"),
        )
      : null,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_PROPS: MarketplaceCardProps = {
  id: "42",
  type: "Safe",
  score: 85,
  totalCommitments: 10,
  successRate: 99,
  amount: "1000 XLM",
  duration: "30 days",
  yield: "8.5% APY",
  maxLoss: "2%",
  owner: "GABCDE123456FGHIJK789012",
  price: "1050 XLM",
  forSale: true,
};

type TypeFixture = {
  type: CommitmentType;
  borderClass: string;
  badgeClass: string;
  scoreClass: string;
};

const TYPE_FIXTURES: TypeFixture[] = [
  {
    type: "Safe",
    borderClass: "border-[#00C95066]",
    badgeClass: "bg-[#0f2a1d]",
    scoreClass: "text-[#00C950]/95",
  },
  {
    type: "Balanced",
    borderClass: "border-[#2B7FFF66]",
    badgeClass: "bg-[#122238]",
    scoreClass: "text-[#51A2FF]/95",
  },
  {
    type: "Aggressive",
    borderClass: "border-[#FF690066]",
    badgeClass: "bg-[#2b1c10]",
    scoreClass: "text-[#FF8904]/95",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCard(overrides: Partial<MarketplaceCardProps> = {}) {
  return render(<MarketplaceCard {...BASE_PROPS} {...overrides} />);
}

function getArticle() {
  return screen.getByRole("article");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MarketplaceCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Type variants ─────────────────────────────────────────────────────────

  describe("type variants", () => {
    it.each(TYPE_FIXTURES)(
      "renders $type badge label",
      ({ type }) => {
        renderCard({ type });
        expect(screen.getByText(type)).toBeInTheDocument();
      },
    );

    it.each(TYPE_FIXTURES)(
      "applies correct border class for $type",
      ({ type, borderClass }) => {
        renderCard({ type });
        expect(getArticle().className).toContain(borderClass);
      },
    );

    it.each(TYPE_FIXTURES)(
      "applies correct badge background for $type",
      ({ type, badgeClass }) => {
        renderCard({ type });
        const badge = screen.getByText(type);
        expect(badge.className).toContain(badgeClass);
      },
    );

    it.each(TYPE_FIXTURES)(
      "applies correct score color for $type",
      ({ type, scoreClass }) => {
        renderCard({ type, score: 75 });
        // Score badge is the span containing "75%"
        const scoreEl = screen.getByText("75%");
        expect(scoreEl.className).toContain(scoreClass);
      },
    );

    it.each(TYPE_FIXTURES)(
      "renders an SVG type icon for $type",
      ({ type }) => {
        const { container } = renderCard({ type });
        // Icon container is aria-hidden; verify an SVG is present inside it
        const iconContainer = container.querySelector('[aria-hidden="true"]');
        expect(iconContainer?.querySelector("svg")).toBeInTheDocument();
      },
    );
  });

  // ── Compliance score ──────────────────────────────────────────────────────

  describe("compliance score", () => {
    it("clamps NaN to 0%", () => {
      renderCard({ score: NaN });
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("clamps negative score to 0%", () => {
      renderCard({ score: -10 });
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("clamps score above 100 to 100%", () => {
      renderCard({ score: 150 });
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("rounds fractional score to nearest integer", () => {
      renderCard({ score: 84.6 });
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("displays exact score at boundaries", () => {
      renderCard({ score: 100 });
      expect(screen.getByText("100%")).toBeInTheDocument();

      renderCard({ score: 0 });
      expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
    });
  });

  // ── Data fields ───────────────────────────────────────────────────────────

  describe("data fields", () => {
    it("displays the amount", () => {
      renderCard({ amount: "5000 USDC" });
      expect(screen.getByText("5000 USDC")).toBeInTheDocument();
    });

    it("displays the duration", () => {
      renderCard({ duration: "90 days" });
      expect(screen.getByText("90 days")).toBeInTheDocument();
    });

    it("displays the yield", () => {
      renderCard({ yield: "12.3% APY" });
      expect(screen.getByText("12.3% APY")).toBeInTheDocument();
    });

    it("displays the maxLoss", () => {
      renderCard({ maxLoss: "5%" });
      expect(screen.getByText("5%")).toBeInTheDocument();
    });

    it("truncates a long owner address", () => {
      const longAddr = "GABCDEF123456GHIJKLMNO789";
      renderCard({ owner: longAddr });
      // Expect truncated form: first 6 + "..." + last 4
      const expected = `${longAddr.slice(0, 6)}...${longAddr.slice(-4)}`;
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it("displays a short owner address unchanged", () => {
      renderCard({ owner: "GABC" });
      expect(screen.getByText("GABC")).toBeInTheDocument();
    });

    it("displays a 12-char address unchanged (boundary)", () => {
      renderCard({ owner: "GABCDEF12345" }); // exactly 12 chars
      expect(screen.getByText("GABCDEF12345")).toBeInTheDocument();
    });

    it("formats the commitment ID as #CMT-NNN (zero-padded to 3)", () => {
      renderCard({ id: "7" });
      expect(screen.getByText("#CMT-007")).toBeInTheDocument();
    });

    it("does not over-pad IDs longer than 3 digits", () => {
      renderCard({ id: "1234" });
      expect(screen.getByText("#CMT-1234")).toBeInTheDocument();
    });
  });

  // ── Trust badge ───────────────────────────────────────────────────────────

  describe("trust badge", () => {
    it("defaults to unverified when trustLevel is omitted", () => {
      renderCard({ trustLevel: undefined });
      expect(screen.getByRole("status", { name: "Self-Reported" })).toBeInTheDocument();
    });

    it("renders the verified trust badge", () => {
      renderCard({ trustLevel: "verified" });
      expect(screen.getByRole("status", { name: "Verified Seller" })).toBeInTheDocument();
    });

    it("renders the reputable trust badge", () => {
      renderCard({ trustLevel: "reputable" });
      expect(screen.getByRole("status", { name: "Top Reputation" })).toBeInTheDocument();
    });

    it("renders the unverified trust badge", () => {
      renderCard({ trustLevel: "unverified" });
      expect(screen.getByRole("status", { name: "Self-Reported" })).toBeInTheDocument();
    });
  });

  // ── forSale=true ──────────────────────────────────────────────────────────

  describe("forSale=true", () => {
    it("shows the price", () => {
      renderCard({ forSale: true, price: "999 XLM" });
      expect(screen.getByText("999 XLM")).toBeInTheDocument();
    });

    it("shows the price label", () => {
      renderCard({ forSale: true });
      // "Price" label is inside aria-label="Price" container
      expect(screen.getByText("Price")).toBeInTheDocument();
    });

    it("shows a View button with aria-label View {id}", () => {
      renderCard({ forSale: true, id: "42" });
      expect(screen.getByRole("button", { name: "View 42" })).toBeInTheDocument();
    });

    it("shows a Trade link with aria-label Trade {id}", () => {
      renderCard({ forSale: true, id: "42" });
      expect(screen.getByRole("link", { name: "Trade 42" })).toBeInTheDocument();
    });

    it("Trade link uses the default href based on id", () => {
      renderCard({ forSale: true, id: "abc def" });
      const link = screen.getByRole("link", { name: /Trade/ });
      expect(link).toHaveAttribute(
        "href",
        `/marketplace/trade?id=${encodeURIComponent("abc def")}`,
      );
    });

    it("Trade link uses the custom tradeHref when provided", () => {
      renderCard({ forSale: true, tradeHref: "/custom/trade/path" });
      const link = screen.getByRole("link", { name: /Trade/ });
      expect(link).toHaveAttribute("href", "/custom/trade/path");
    });

    it("does not show 'Not for sale' when forSale=true", () => {
      renderCard({ forSale: true });
      expect(screen.queryByText("Not for sale")).not.toBeInTheDocument();
    });

    it("opens the detail modal when View is clicked", () => {
      renderCard({ forSale: true, id: "99" });
      expect(screen.queryByTestId("commitment-modal")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "View 99" }));

      const modal = screen.getByTestId("commitment-modal");
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute("data-commitment-id", "99");
    });

    it("closes the modal when the modal's onClose fires", () => {
      renderCard({ forSale: true, id: "99" });
      fireEvent.click(screen.getByRole("button", { name: "View 99" }));
      expect(screen.getByTestId("commitment-modal")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByTestId("commitment-modal")).not.toBeInTheDocument();
    });
  });

  // ── forSale=false (not for sale) ──────────────────────────────────────────

  describe("forSale=false", () => {
    it("shows the 'Not for sale' indicator", () => {
      renderCard({ forSale: false });
      expect(screen.getByText("Not for sale")).toBeInTheDocument();
    });

    it("marks the 'Not for sale' indicator as aria-disabled", () => {
      renderCard({ forSale: false });
      const banner = screen.getByText("Not for sale").closest("[aria-disabled]");
      expect(banner).toHaveAttribute("aria-disabled", "true");
    });

    it("shows a View button", () => {
      renderCard({ forSale: false, id: "5" });
      expect(screen.getByRole("button", { name: "View 5" })).toBeInTheDocument();
    });

    it("does not show a Trade link", () => {
      renderCard({ forSale: false, id: "5" });
      expect(screen.queryByRole("link", { name: /Trade/ })).not.toBeInTheDocument();
    });

    it("does not show the price block", () => {
      renderCard({ forSale: false, price: "999 XLM" });
      // price text should not be rendered when not for sale
      expect(screen.queryByText("999 XLM")).not.toBeInTheDocument();
      expect(screen.queryByText("Price")).not.toBeInTheDocument();
    });

    it("opens the detail modal when View is clicked", () => {
      renderCard({ forSale: false, id: "7" });
      expect(screen.queryByTestId("commitment-modal")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "View 7" }));

      expect(screen.getByTestId("commitment-modal")).toBeInTheDocument();
      expect(screen.getByTestId("commitment-modal")).toHaveAttribute(
        "data-commitment-id",
        "7",
      );
    });
  });

  // ── Accessible semantics ──────────────────────────────────────────────────

  describe("accessible semantics", () => {
    it("article has aria-label 'Commitment {id}'", () => {
      renderCard({ id: "42" });
      expect(
        screen.getByRole("article", { name: "Commitment 42" }),
      ).toBeInTheDocument();
    });

    it("View button has aria-label 'View {id}'", () => {
      renderCard({ forSale: true, id: "42" });
      expect(
        screen.getByRole("button", { name: "View 42" }),
      ).toBeInTheDocument();
    });

    it("Trade link has aria-label 'Trade {id}'", () => {
      renderCard({ forSale: true, id: "42" });
      expect(
        screen.getByRole("link", { name: "Trade 42" }),
      ).toBeInTheDocument();
    });

    it("type icon container is aria-hidden", () => {
      const { container } = renderCard();
      const iconContainers = container.querySelectorAll('[aria-hidden="true"]');
      // At least one aria-hidden element (the icon wrapper div)
      expect(iconContainers.length).toBeGreaterThan(0);
    });

    it("price block has aria-label 'Price'", () => {
      renderCard({ forSale: true });
      expect(screen.getByLabelText("Price")).toBeInTheDocument();
    });

    it("uses definition list semantics for stats (dt/dd pairs)", () => {
      const { container } = renderCard();
      const dl = container.querySelector("dl");
      expect(dl).toBeInTheDocument();
      expect(dl?.querySelectorAll("dt").length).toBeGreaterThan(0);
      expect(dl?.querySelectorAll("dd").length).toBeGreaterThan(0);
    });

    it("data field labels are visible text, not just aria labels", () => {
      renderCard();
      expect(screen.getByText("Amount")).toBeVisible();
      expect(screen.getByText("Duration")).toBeVisible();
      expect(screen.getByText("Yield")).toBeVisible();
      expect(screen.getByText("Max Loss")).toBeVisible();
      expect(screen.getByText("Owner")).toBeVisible();
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles owner address with only whitespace gracefully", () => {
      // truncateAddress trims first; all-space address length ≤ 12 after trim
      renderCard({ owner: "   " });
      // Should render the trimmed empty string (no crash)
      expect(getArticle()).toBeInTheDocument();
    });

    it("renders without crashing when all optional props are omitted", () => {
      const { id, type, score, amount, duration, yield: apy, maxLoss, owner, price, forSale } = BASE_PROPS;
      render(
        <MarketplaceCard
          id={id}
          type={type}
          score={score}
          amount={amount}
          duration={duration}
          yield={apy}
          maxLoss={maxLoss}
          owner={owner}
          price={price}
          forSale={forSale}
          // trustLevel and tradeHref intentionally omitted
        />,
      );
      expect(getArticle()).toBeInTheDocument();
    });

    it("encodes special characters in the default trade href", () => {
      renderCard({ forSale: true, id: "a b&c" });
      const link = screen.getByRole("link", { name: /Trade/ });
      expect(link.getAttribute("href")).toBe(
        `/marketplace/trade?id=${encodeURIComponent("a b&c")}`,
      );
    });
  });

  describe("accessibility", () => {
    it("should have no accessibility violations when forSale is true", async () => {
      const { container } = renderCard({ forSale: true });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have no accessibility violations when forSale is false", async () => {
      const { container } = renderCard({ forSale: false });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
